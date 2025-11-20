let Classes = {};
let CurrentClass = null;
let CachedData = null;
let IsDataLoaded = false;
let Recycler = null;
let ClassDataArray = [];
let FilteredArray = [];
let SDKUpdated = true;

function GetQueryParam(key) {
    try { return new URLSearchParams(location.search).get(key); } catch { return null; }
}
function SetQueryParam(key, value) {
    try {
        const url = new URL(location.href);
        if (value == null || value === '') url.searchParams.delete(key);
        else url.searchParams.set(key, value);
        history.replaceState({}, '', url.toString());
    } catch { }
}

function SaveToCache(Data) {
    try {
        const CacheData = {
            data: Data,
            timestamp: Date.now(),
            version: '1.0'
        };
        localStorage.setItem('sdk_cache', JSON.stringify(CacheData));
        console.log('Data cached successfully');
    } catch (error) {
        console.warn('Failed to cache data:', error);
    }
}

function LoadFromCache() {
    try {
        const Cached = localStorage.getItem('sdk_cache');
        if (!Cached) return null;

        const CacheData = JSON.parse(Cached);
        const Now = Date.now();
        const CacheAge = Now - CacheData.timestamp;
        const MaxAge = 24 * 60 * 60 * 1000;

        if (CacheAge > MaxAge) {
            localStorage.removeItem('sdk_cache');
            return null;
        }

        console.log('Data loaded from cache');
        return CacheData.data;
    } catch (error) {
        console.warn('Failed to load from cache:', error);
        localStorage.removeItem('sdk_cache');
        return null;
    }
}

function ClearCache() {
    localStorage.removeItem('sdk_cache');
    console.log('Cache cleared');
    location.reload();
}

async function LoadSDKData() {
    try {
        const StatusEl = document.getElementById('LoadingStatus');
        const ProgressBar = document.querySelector('.LoadingProgressBar');
        const Response = await fetch('./Data/sdk_data.json', { cache: 'no-store' });
        if (!Response.ok) throw new Error(`HTTP error! status: ${Response.status}`);
        const Data = await Response.json();
        let ClassArray = [];
        if (Array.isArray(Data)) ClassArray = Data; else if (Data.Classes && Array.isArray(Data.Classes)) ClassArray = Data.Classes; else if (Data.classes && Array.isArray(Data.classes)) ClassArray = Data.classes;
        const Total = ClassArray.length || 0;
        StatusEl.textContent = `Loading classes... 0 / ${Total}`;
        ProgressBar.style.width = '0%';
        const OutputClasses = { ...Classes };
        const BatchSize = 1000;
        for (let i = 0; i < Total; i += BatchSize) {
            const batch = ClassArray.slice(i, i + BatchSize);
            for (let j = 0; j < batch.length; j++) {
                const cls = batch[j];
                const name = (cls.N || cls.n || '').toString();
                if (!name) continue;
                OutputClasses[name] = {
                    n: cls.N || cls.n || '',
                    p: cls.P || cls.p || '',
                    s: cls.S || cls.s || 0,
                    m: Array.isArray(cls.M || cls.m) ? (cls.M || cls.m).map(member => ({
                        n: (member && (member.N || member.n)) ? member.N || member.n : '',
                        t: (member && (member.T || member.t)) ? member.T || member.t : '',
                        o: (member && (member.O || member.o)) ? member.O || member.o : '',
                        s: (member && (member.S || member.s)) ? member.S || member.s : ''
                    })) : [],
                    t: cls.T || cls.t || ''
                };
            }
            const processed = Math.min(i + BatchSize, Total);
            StatusEl.textContent = `Loading classes... ${processed} / ${Total}`;
            const pct = Total > 0 ? Math.round((processed / Total) * 100) : 100;
            ProgressBar.style.width = pct + '%';
            await new Promise(requestAnimationFrame);
        }
        Classes = OutputClasses;
        return true;
    } catch (error) {
        console.error('LoadSDKData error:', error);
        return false;
    }
}

async function LoadGlobals() {
    try {
        const res = await fetch('./Data/globals.json', { cache: 'no-store' });
        if (!res.ok) return null;
        const data = await res.json();
        class Globals {
            constructor(raw) {
                this.raw = raw || { bases: {}, offsets: {} };
            }
            hex(str) {
                if (typeof str !== 'string') return 0;
                return parseInt(str, 16) >>> 0;
            }
            base(name) {
                return this.hex(this.raw?.bases?.[name]);
            }
            offset(scope, key) {
                return this.hex(this.raw?.offsets?.[scope]?.[key]);
            }
            get(path) {
                try {
                    return path.split('.').reduce((o, k) => (o ? o[k] : undefined), this.raw);
                } catch {
                    return undefined;
                }
            }
        }
        const g = new Globals(data);
        window.AcediaGlobals = data;
        window.globals = g;
        console.log('Globals loaded', data);
        return g;
    } catch (e) {
        console.warn('Failed to load globals');
        return null;
    }
}

async function InitializeViewer() {
    document.getElementById('LoadingOverlay').style.display = 'flex';

    const globalsInstance = await LoadGlobals();
    Classes = {};
    try {
        if (globalsInstance && globalsInstance.raw) {
            const VirtualName = 'Offsets and Globals';
            const Members = [];
            const raw = globalsInstance.raw;
            if (raw.bases) {
                Object.keys(raw.bases).forEach(key => {
                    Members.push({ n: key, t: 'hex', o: raw.bases[key] || '', s: '' });
                });
            }
            if (raw.offsets) {
                Object.keys(raw.offsets).forEach(scope => {
                    const group = raw.offsets[scope] || {};
                    Object.keys(group).forEach(k => {
                        Members.push({ n: k, t: 'hex', o: group[k] || '', s: '' });
                    });
                });
            }
            Classes[VirtualName] = { n: VirtualName, p: '', s: 0, m: Members, t: 'Globals' };
        }
    } catch { }

    let Loaded = true;
    if (SDKUpdated) {
        Loaded = await LoadSDKData();
    }

    if (Loaded && Object.keys(Classes).length > 0) {
        document.getElementById('LoadingOverlay').style.display = 'none';

        if (!SDKUpdated && Classes['Globals']) {
            Classes = { 'Globals': Classes['Globals'] };
        }

        try {
            const notice = document.querySelector('.Notice');
            if (notice) {
                if (SDKUpdated) {
                    notice.classList.remove('error');
                    notice.classList.add('success');
                    notice.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg><span>SDK Up to Date</span>';
                } else {
                    notice.classList.remove('success');
                    notice.classList.add('error');
                    notice.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2c.7 0 1.34.36 1.7.96l8.2 14.2c.73 1.27-.18 2.84-1.7 2.84H3.8c-1.52 0-2.43-1.57-1.7-2.84L10.3 2.96C10.66 2.36 11.3 2 12 2zm0 6c-.55 0-1 .45-1 1v5c0 .55.45 1 1 1s1-.45 1-1V9c0-.55-.45-1-1-1zm0 10a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5z"/></svg><span>Not Updated - Using Globals</span>';
                }
            }
        } catch { }

        PopulateClassList();

        // Initialize advanced search index
        if (window.AdvancedSearch && window.AdvancedSearch.initIndex) {
            window.AdvancedSearch.initIndex(Classes);
        }

        const desired = GetQueryParam('Class');
        const FirstClass = Object.keys(Classes)[0];
        if (desired && Classes[desired]) {
            SelectClass(desired);
        } else if (FirstClass) {
            SelectClass(FirstClass);
        }
    } else {
        document.getElementById('LoadingOverlay').style.display = 'none';
        const ClassList = document.getElementById('ClassList');
        ClassList.innerHTML = '<div class="Error"><b>No SDK data found.</b><br><br>This usually means we are in the middle of updating the site or are in the process of dumping the latest SDK.</div>';
    }
}

function PopulateClassList() {
    const ClassList = document.getElementById('ClassList');
    ClassList.innerHTML = '';
    ClassList.classList.add('RecyclerActive');
    ClassDataArray = Object.keys(Classes).sort().map(name => ({ name, lower: name.toLowerCase() }));
    FilteredArray = ClassDataArray.slice();
    const viewport = document.createElement('div');
    viewport.className = 'RecyclerViewport';
    viewport.id = 'RecyclerViewport';
    viewport.style.minHeight = '100%';
    viewport.style.width = '100%';
    viewport.style.maxWidth = '100%';
    viewport.style.overflowX = 'hidden';
    viewport.style.padding = '8px';
    viewport.style.boxSizing = 'border-box';
    const spacer = document.createElement('div');
    spacer.className = 'RecyclerSpacer';
    spacer.id = 'RecyclerSpacer';
    viewport.appendChild(spacer);
    ClassList.appendChild(viewport);
    Recycler = CreateVanillaRecyclerView({
        viewport,
        rowHeight: 48,
        overscan: 6,
        getCount: () => FilteredArray.length,
        renderRow: (rowEl, index) => {
            const item = FilteredArray[index];
            if (!item) return;
            rowEl.className = 'ClassItem';
            rowEl.textContent = item.name;
            rowEl.dataset.name = item.name;
            rowEl.dataset.lower = item.lower;

            if (item.name.length > 25) {
                rowEl.title = item.name;
            } else {
                rowEl.removeAttribute('title');
            }

            rowEl.onclick = () => SelectClass(item.name);
            if (CurrentClass && CurrentClass.n === item.name) {
                rowEl.classList.add('Active');
            }
        }
    });
    Recycler.update();
    console.log(`Made By https://github.com/paysonism\n\nPlease Star the repo if you like this project and would like it to keep recieving updates -> https://github.com/paysonism/Neptune-SDK-Browser`);
}

function SelectClass(ClassName) {
    document.querySelectorAll('.ClassItem').forEach(item => { item.classList.remove('Active'); });
    if (Recycler && typeof Recycler.markActive === 'function') {
        Recycler.markActive(ClassName);
    } else {
        document.querySelectorAll('.ClassItem').forEach(item => {
            if (item.textContent === ClassName) { item.classList.add('Active'); }
        });
    }
    
    CurrentClass = Classes[ClassName];
    if (CurrentClass) {
        SetQueryParam('Class', ClassName);
        document.getElementById('ClassTitle').textContent = ClassName;
        
        const Inheritance = CurrentClass.p ? `${CurrentClass.p} > UObject` : 'UObject';
        document.getElementById('Inheritance').textContent = Inheritance;
        
        document.getElementById('MemberCount').textContent = CurrentClass.m ? CurrentClass.m.length : 0;
        document.getElementById('ClassSize').textContent = '0x' + CurrentClass.s.toString(16).toUpperCase();
        document.getElementById('ClassType').textContent = CurrentClass.t || 'class';
        document.getElementById('Stats').style.display = 'flex';
        
        
        const isGlobals = (ClassName === 'Globals');
        document.body.classList.toggle('GlobalsMode', isGlobals);
        
        
        const sizeCard = document.querySelectorAll('.Stats .StatCard')[1];
        if (sizeCard) sizeCard.style.display = isGlobals ? 'none' : '';
        
        const Tbody = document.getElementById('MembersTableBody');
        Tbody.innerHTML = '';
        
        if (CurrentClass.m && CurrentClass.m.length > 0) {
            CurrentClass.m.forEach(member => {
                const BasicTypes = ['bool', 'float', 'int', 'hex','char', 'double', 'void', 'struct', 'class', 'enum', 'string', 'vector', 'array', 'map', 'set', 'list', 'pair', 'tuple', 'uint8_t', 'uint16_t', 'uint32_t', 'uint64_t', 'int8_t', 'int16_t', 'int32_t', 'int64_t', 'size_t', 'ptrdiff_t'];
                const isBasicType = member.t && BasicTypes.includes(member.t.toLowerCase());
                const typeClass = isBasicType ? 'TypeColumn basic-type' : 'TypeColumn';
                const Row = document.createElement('tr');
                
                if (isGlobals) {
                    
                    Row.innerHTML = `
                        <td class="${typeClass}" ${isBasicType ? '' : `onclick="NavigateToType('${member.t}')"`}>${member.t}</td>
                        <td class="MemberColumn">${member.n}</td>
                        <td class="OffsetColumn">${member.o}</td>
                    `;
                } else {
                    
                    Row.innerHTML = `
                        <td class="${typeClass}" ${isBasicType ? '' : `onclick="NavigateToType('${member.t}')"`}>${member.t}</td>
                        <td class="MemberColumn">${member.n}</td>
                        <td class="OffsetColumn">${member.o}</td>
                        <td class="SizeColumn">${member.s}</td>
                    `;
                }
                Tbody.appendChild(Row);
            });
        } else {
            const Row = document.createElement('tr');
            const colSpan = isGlobals ? '3' : '4';
            Row.innerHTML = `<td colspan="${colSpan}" class="NoData">No members found</td>`;
            Tbody.appendChild(Row);
        }
        
        UpdateStructView();
    }
}

function UpdateStructView() {
    const StructViewer = document.getElementById('StructViewer');

    if (!CurrentClass) {
        StructViewer.innerHTML = '<div class="NoData">Select a class to view its structure</div>';
        return;
    }

    const Inheritance = CurrentClass.p ? `${CurrentClass.p} > UObject` : 'UObject';

    let StructHTML = `
        <div class="StructHeader">
            <div class="StructName">${CurrentClass.n}</div>
            <div class="StructInfo">
                <span>Type: ${CurrentClass.t || 'class'}</span>
                <span>Size: 0x${CurrentClass.s.toString(16).toUpperCase()}</span>
                <span>Inherits: ${Inheritance}</span>
            </div>
        </div>
        <div class="StructMembers">
    `;

    if (CurrentClass.m && CurrentClass.m.length > 0) {
        CurrentClass.m.forEach(member => {
            const BasicTypes = ['bool', 'float', 'int', 'char', 'double', 'void', 'struct', 'class', 'enum', 'string', 'vector', 'array', 'map', 'set', 'list', 'pair', 'tuple', 'uint8_t', 'uint16_t', 'uint32_t', 'uint64_t', 'int8_t', 'int16_t', 'int32_t', 'int64_t', 'size_t', 'ptrdiff_t'];
            const isBasicType = member.t && BasicTypes.includes(member.t.toLowerCase());
            const typeClass = isBasicType ? 'MemberType basic-type' : 'MemberType';

            StructHTML += `
                <div class="StructMember">
                    <div class="MemberHeader">
                        <span class="MemberName">${member.n}</span>
                        <span class="${typeClass}" ${isBasicType ? '' : `onclick="NavigateToType('${member.t}')"`}>${member.t}</span>
                    </div>
                    <div class="MemberDetails">
                        <span class="MemberOffset">Offset: ${member.o}</span>
                        <span class="MemberSize">Size: ${member.s}</span>
                    </div>
                </div>
            `;
        });
    } else {
        StructHTML += '<div class="NoData">No members found</div>';
    }

    StructHTML += '</div>';
    StructViewer.innerHTML = StructHTML;
}



function NavigateToType(TypeName) {
    const CleanTypeName = TypeName.replace(/[*<>]/g, '').trim();

    const BasicTypes = ['bool', 'float', 'int', 'char', 'double', 'void', 'struct', 'class', 'enum', 'string', 'vector', 'array', 'map', 'set', 'list', 'pair', 'tuple', 'uint8_t', 'uint16_t', 'uint32_t', 'uint64_t', 'int8_t', 'int16_t', 'int32_t', 'int64_t', 'size_t', 'ptrdiff_t'];

    if (BasicTypes.includes(CleanTypeName.toLowerCase())) {
        return;
    }

    if (Classes[CleanTypeName]) {
        SelectClass(CleanTypeName);
        document.querySelector('.MainContent').scrollTop = 0;
    } else {
        document.getElementById('TopSearchInput').value = CleanTypeName;
        GlobalSearchDropdown();
    }
}

function ShowTab(TabName) {
    document.querySelectorAll('.Tab').forEach(tab => {
        tab.classList.remove('Active');
    });
    event.target.classList.add('Active');

    document.getElementById('OverviewContent').classList.add('Hidden');
    document.getElementById('StructContent').classList.add('Hidden');
    document.getElementById(TabName.charAt(0).toUpperCase() + TabName.slice(1) + 'Content').classList.remove('Hidden');

    if (TabName === 'struct') {
        UpdateStructView();
    }
}

function levenshtein(a, b) {
    const an = a.length;
    const bn = b.length;
    if (an === 0) return bn;
    if (bn === 0) return an;
    const matrix = [];
    for (let i = 0; i <= bn; ++i) matrix[i] = [i];
    for (let j = 0; j <= an; ++j) matrix[0][j] = j;
    for (let i = 1; i <= bn; ++i) {
        for (let j = 1; j <= an; ++j) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    return matrix[bn][an];
}

function FilterClasses() {
    const SearchTerm = document.getElementById('SearchInput').value.toLowerCase();
    if (!SearchTerm) {
        FilteredArray = ClassDataArray.slice();
    } else {
        FilteredArray = ClassDataArray.filter(it => it.lower.includes(SearchTerm));
    }
    if (Recycler) Recycler.update(true);
}


function GlobalSearchDropdown() {
    console.log('GlobalSearchDropdown called');
    const SearchTerm = document.getElementById('TopSearchInput').value.toLowerCase();
    const Dropdown = document.getElementById('GlobalSearchDropdown');
    if (!SearchTerm) {
        Dropdown.style.display = 'none';
        Dropdown.innerHTML = '';
        return;
    }
    const Results = [];
    Object.keys(Classes).forEach(className => {
        const ClassData = Classes[className];
        if (className.toLowerCase().includes(SearchTerm)) {
            Results.push({
                type: 'class',
                className: className,
                match: className,
                matchIndex: className.toLowerCase().indexOf(SearchTerm),
                matchLength: SearchTerm.length
            });
        }
        if (ClassData && ClassData.m) {
            ClassData.m.forEach(member => {
                let found = false;
                let matchValue = '';
                let matchIndex = -1;

                if (member.n && member.n.toLowerCase().includes(SearchTerm)) {
                    found = true;
                    matchValue = member.n;
                    matchIndex = member.n.toLowerCase().indexOf(SearchTerm);
                } else if (member.o && member.o.toLowerCase().includes(SearchTerm)) {
                    found = true;
                    matchValue = member.o;
                    matchIndex = member.o.toLowerCase().indexOf(SearchTerm);
                }

                if (found) {
                    Results.push({
                        type: 'member',
                        className: className,
                        name: member.n,
                        typeName: member.t,
                        offset: member.o,
                        size: member.s,
                        match: matchValue,
                        matchIndex: matchIndex,
                        matchLength: SearchTerm.length
                    });
                }
            });
        }
    });
    if (Results.length > 0) {
        Dropdown.innerHTML = '';
        Results.slice(0, 30).forEach(result => {
            const Item = document.createElement('div');
            Item.className = 'GlobalSearchItem';
            let displayName = '';
            if (result.type === 'class') {
                displayName = result.className.substring(0, result.matchIndex) +
                    '<span style="background:#ffeb3b;color:#000;">' +
                    result.className.substring(result.matchIndex, result.matchIndex + result.matchLength) +
                    '</span>' +
                    result.className.substring(result.matchIndex + result.matchLength);
            } else {
                displayName = `<span style='color:#007acc;'>${result.className}</span>: `;
                if (result.name.toLowerCase().includes(SearchTerm)) {
                    const idx = result.name.toLowerCase().indexOf(SearchTerm);
                    displayName += result.name.substring(0, idx) +
                        '<span style="background:#ffeb3b;color:#000;">' +
                        result.name.substring(idx, idx + SearchTerm.length) +
                        '</span>' +
                        result.name.substring(idx + SearchTerm.length);
                } else {
                    displayName += result.name;
                }
                displayName += ` - `;
                if (result.offset.toLowerCase().includes(SearchTerm)) {
                    const idx = result.offset.toLowerCase().indexOf(SearchTerm);
                    displayName += result.offset.substring(0, idx) +
                        '<span style="background:#ffeb3b;color:#000;">' +
                        result.offset.substring(idx, idx + SearchTerm.length) +
                        '</span>' +
                        result.offset.substring(idx + SearchTerm.length);
                } else {
                    displayName += result.offset;
                }
            }
            Item.innerHTML = displayName;
            Item.onclick = () => {
                SelectClass(result.className);
                document.getElementById('TopSearchInput').value = '';
                Dropdown.style.display = 'none';

                if (result.type === 'member') {
                    setTimeout(() => {
                        const TableRows = document.querySelectorAll('#MembersTableBody tr');
                        TableRows.forEach(row => {
                            const cells = row.querySelectorAll('td');
                            if (cells.length === 4) {
                                const memberCell = cells[1].textContent;
                                const offsetCell = cells[2].textContent;

                                if (memberCell === result.name || offsetCell === result.offset) {
                                    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    row.style.backgroundColor = 'rgba(255, 235, 59, 0.3)';
                                    setTimeout(() => {
                                        row.style.backgroundColor = '';
                                    }, 2000);
                                }
                            }
                        });
                    }, 100);
                }
            };
            Dropdown.appendChild(Item);
        });
        Dropdown.style.display = 'block';
    } else {
        Dropdown.innerHTML = '<div class="GlobalSearchItem">No results found</div>';
        Dropdown.style.display = 'block';
    }
}

function TopSearch() {
    const SearchTerm = document.getElementById('TopSearchInput').value.toLowerCase();

    if (!CurrentClass || !CurrentClass.m) {
        return;
    }

    const TableRows = document.querySelectorAll('#MembersTableBody tr');

    TableRows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length === 4) {
            const typeCell = cells[0].textContent.toLowerCase();
            const memberCell = cells[1].textContent.toLowerCase();
            const offsetCell = cells[2].textContent.toLowerCase();
            const sizeCell = cells[3].textContent.toLowerCase();

            const matches = typeCell.includes(SearchTerm) ||
                memberCell.includes(SearchTerm) ||
                offsetCell.includes(SearchTerm) ||
                sizeCell.includes(SearchTerm);

            if (SearchTerm === '') {
                row.style.display = '';
                row.style.backgroundColor = '';
            } else if (matches) {
                row.style.display = '';
                row.style.backgroundColor = 'rgba(0, 122, 204, 0.1)';
            } else {
                row.style.display = 'none';
            }
        }
    });
}

function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}


document.addEventListener('DOMContentLoaded', () => {
    InitializeViewer();
    document.getElementById('SearchInput').addEventListener('input', debounce(FilterClasses, 300));
    document.getElementById('TopSearchInput').addEventListener('input', debounce(GlobalSearchDropdown, 200));

});

(function setupSidebarResizer() {
    const resizer = document.getElementById('SidebarResizer');
    const sidebar = document.querySelector('.Sidebar');
    const minW = 220, maxW = 700;
    function applySaved() {
        try {
            const saved = localStorage.getItem('sidebar_width');
            if (saved) { sidebar.style.width = Math.min(maxW, Math.max(minW, parseInt(saved))) + 'px'; }
        } catch { }
    }
    applySaved();
    let dragging = false;
    resizer.addEventListener('mousedown', (e) => { dragging = true; document.body.style.userSelect = 'none'; e.preventDefault(); });
    window.addEventListener('mouseup', () => { if (!dragging) return; dragging = false; document.body.style.userSelect = ''; try { localStorage.setItem('sidebar_width', parseInt(getComputedStyle(sidebar).width)); } catch { } if (Recycler) Recycler.update(true); });
    window.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        const sidebarLeft = sidebar.getBoundingClientRect().left;
        const newW = Math.min(maxW, Math.max(minW, e.clientX - sidebarLeft));
        sidebar.style.width = newW + 'px';
        if (Recycler) Recycler.update();
    });
    window.addEventListener('resize', () => { if (Recycler) Recycler.update(); });
})();
function CreateVanillaRecyclerView(config) {
    const viewport = config.viewport;
    const spacer = viewport.querySelector('#RecyclerSpacer');
    const rowHeight = config.rowHeight || 40;
    const overscan = config.overscan || 4;
    const getCount = config.getCount;
    const renderRow = config.renderRow;
    const pool = [];
    let attached = 0;
    function ensurePoolSize(size) {
        while (pool.length < size) {
            const el = document.createElement('div');
            el.style.position = 'absolute';
            el.style.left = '0';
            el.style.right = '0';
            el.style.width = '100%';
            el.style.maxWidth = '100%';
            el.style.height = rowHeight + 'px';
            el.style.top = '0';
            el.style.display = 'block';
            el.style.zIndex = '1';
            el.style.overflow = 'hidden';
            el.style.whiteSpace = 'nowrap';
            el.style.textOverflow = 'ellipsis';
            el.style.paddingLeft = '20px';
            el.style.paddingRight = '20px';
            el.style.boxSizing = 'border-box';
            viewport.appendChild(el);
            pool.push(el);
        }
    }
    function layout() {
        const total = getCount();
        spacer.style.height = (total * rowHeight) + 'px';
        const scrollTop = viewport.scrollTop;
        let height = viewport.clientHeight;
        if (!height || height <= 0) {
            height = (viewport.parentElement && viewport.parentElement.clientHeight) || window.innerHeight || 600;
            viewport.style.height = height + 'px';
        }
        const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
        const end = Math.min(total, Math.ceil((scrollTop + height) / rowHeight) + overscan);
        const need = Math.max(0, end - start);
        ensurePoolSize(need);
        attached = need;
        for (let i = 0; i < need; i++) {
            const idx = start + i;
            const el = pool[i];
            el.style.transform = `translateY(${idx * rowHeight}px)`;
            renderRow(el, idx);
        }
        for (let i = need; i < pool.length; i++) {
            pool[i].style.transform = 'translateY(-99999px)';
        }
    }
    function update(force) {
        if (force) { pool.forEach(el => { el.innerHTML = ''; el.className = ''; }); }
        layout();
        requestAnimationFrame(layout);
    }
    function markActive(name) {
        for (let i = 0; i < attached; i++) {
            const el = pool[i];
            const match = el && el.dataset && el.dataset.name === name;
            if (match) el.classList.add('Active'); else el.classList.remove('Active');
        }
    }
    viewport.addEventListener('scroll', layout);
    window.addEventListener('resize', layout);
    return { update, markActive };
}
