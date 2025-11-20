/**
 * Advanced Search Overlay for Neptune SDK Browser
 * Provides comprehensive search across classes and members with ranking and fuzzy matching
 */

(function() {
    'use strict';

    // Search indexes
    let classIndex = [];
    let memberIndex = [];
    let isIndexBuilt = false;

    // UI state
    let focusedIndex = -1;
    let currentResults = [];
    const MAX_RESULTS = 250;
    const FUZZY_THRESHOLD = 15;

    // Performance tracking
    let indexBuildTime = 0;

    /**
     * Build search indexes from Classes data
     */
    function buildIndex(Classes) {
        const startTime = performance.now();
        console.log('[AdvancedSearch] Building search index...');

        classIndex = [];
        memberIndex = [];

        Object.keys(Classes).forEach(className => {
            const classData = Classes[className];
            
            // Add to class index
            classIndex.push({
                name: className,
                lower: className.toLowerCase()
            });

            // Add members to member index
            if (classData.m && Array.isArray(classData.m)) {
                classData.m.forEach(member => {
                    if (member.n) {
                        memberIndex.push({
                            className: className,
                            name: member.n,
                            lower: member.n.toLowerCase(),
                            type: member.t || '',
                            typeLower: (member.t || '').toLowerCase(),
                            offset: member.o || '',
                            offsetLower: (member.o || '').toLowerCase()
                        });
                    }
                });
            }
        });

        indexBuildTime = performance.now() - startTime;
        isIndexBuilt = true;
        console.log(`[AdvancedSearch] Index built in ${indexBuildTime.toFixed(2)}ms`);
        console.log(`[AdvancedSearch] Classes: ${classIndex.length}, Members: ${memberIndex.length}`);
    }

    /**
     * Initialize the advanced search system
     */
    function initIndex(Classes) {
        if (!Classes || Object.keys(Classes).length === 0) {
            console.warn('[AdvancedSearch] No Classes data available');
            return;
        }
        buildIndex(Classes);
        setupEventListeners();
    }

    /**
     * Setup event listeners for the overlay
     */
    function setupEventListeners() {
        const overlay = document.getElementById('AdvancedSearchOverlay');
        const closeBtn = document.getElementById('ASClose');
        const queryInput = document.getElementById('ASQuery');
        const classesCheckbox = document.getElementById('ASClasses');
        const membersCheckbox = document.getElementById('ASMembers');
        const typeSearchCheckbox = document.getElementById('ASTypeSearch');

        if (!overlay || !closeBtn || !queryInput) {
            console.warn('[AdvancedSearch] Required elements not found');
            return;
        }

        // Close button
        closeBtn.addEventListener('click', closeAdvancedSearch);

        // Close on overlay click (outside panel)
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeAdvancedSearch();
            }
        });

        // Close on ESC key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && overlay.style.display === 'flex') {
                closeAdvancedSearch();
            }
        });

        // Search input
        queryInput.addEventListener('input', debounce(() => {
            performSearch();
        }, 150));

        // Keyboard navigation in search input
        queryInput.addEventListener('keydown', (e) => {
            handleKeyboardNavigation(e);
        });

        // Filter checkboxes
        if (classesCheckbox) {
            classesCheckbox.addEventListener('change', performSearch);
        }
        if (membersCheckbox) {
            membersCheckbox.addEventListener('change', performSearch);
        }
        if (typeSearchCheckbox) {
            typeSearchCheckbox.addEventListener('change', performSearch);
        }

        console.log('[AdvancedSearch] Event listeners setup complete');
    }

    /**
     * Open the advanced search overlay
     */
    function openAdvancedSearch() {
        const overlay = document.getElementById('AdvancedSearchOverlay');
        const queryInput = document.getElementById('ASQuery');
        
        if (!overlay) return;

        overlay.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        
        if (queryInput) {
            queryInput.focus();
            queryInput.select();
        }

        // Clear previous search
        focusedIndex = -1;
        performSearch();
    }

    /**
     * Close the advanced search overlay
     */
    function closeAdvancedSearch() {
        const overlay = document.getElementById('AdvancedSearchOverlay');
        const queryInput = document.getElementById('ASQuery');
        const topSearchInput = document.getElementById('TopSearchInput');
        
        if (!overlay) return;

        overlay.style.display = 'none';
        document.body.style.overflow = '';
        
        if (queryInput) {
            queryInput.value = '';
        }

        // Clear results
        const resultsDiv = document.getElementById('ASResults');
        if (resultsDiv) {
            resultsDiv.innerHTML = '';
        }

        // Restore focus
        if (topSearchInput) {
            topSearchInput.focus();
        }
    }

    /**
     * Perform the search operation
     */
    function performSearch() {
        const startTime = performance.now();
        
        const query = document.getElementById('ASQuery')?.value.trim() || '';
        const searchClasses = document.getElementById('ASClasses')?.checked || false;
        const searchMembers = document.getElementById('ASMembers')?.checked || false;
        const typeSearch = document.getElementById('ASTypeSearch')?.checked || false;

        if (!query) {
            renderResults([]);
            updateStatus('Enter a search term', 0);
            return;
        }

        const queryLower = query.toLowerCase();
        let results = [];

        // Search classes
        if (searchClasses) {
            classIndex.forEach(item => {
                const score = scoreMatch(item.lower, queryLower);
                if (score > 0) {
                    results.push({
                        type: 'class',
                        name: item.name,
                        score: score,
                        query: query
                    });
                }
            });
        }

        // Search members
        if (searchMembers) {
            memberIndex.forEach(item => {
                let score = 0;
                let matchField = '';

                if (typeSearch) {
                    // Type search mode
                    score = scoreMatch(item.typeLower, queryLower);
                    matchField = 'type';
                } else {
                    // Name search mode
                    score = scoreMatch(item.lower, queryLower);
                    matchField = 'name';
                    
                    // Also check offset for hex matches
                    const offsetScore = scoreOffsetMatch(item.offsetLower, queryLower);
                    if (offsetScore > score) {
                        score = offsetScore;
                        matchField = 'offset';
                    }
                }

                if (score > 0) {
                    results.push({
                        type: 'member',
                        className: item.className,
                        name: item.name,
                        typeName: item.type,
                        offset: item.offset,
                        score: score,
                        matchField: matchField,
                        query: query
                    });
                }
            });
        }

        // Fuzzy search fallback if results are too few
        if (results.length < FUZZY_THRESHOLD) {
            if (searchClasses) {
                classIndex.forEach(item => {
                    // Skip if already matched
                    if (results.some(r => r.type === 'class' && r.name === item.name)) {
                        return;
                    }
                    
                    const distance = levenshtein(item.lower, queryLower);
                    if (distance <= 2 && distance < queryLower.length) {
                        results.push({
                            type: 'class',
                            name: item.name,
                            score: 20 - distance * 5, // Lower score for fuzzy matches
                            query: query,
                            fuzzy: true
                        });
                    }
                });
            }

            if (searchMembers && !typeSearch) {
                memberIndex.forEach(item => {
                    // Skip if already matched
                    if (results.some(r => r.type === 'member' && r.name === item.name && r.className === item.className)) {
                        return;
                    }
                    
                    const distance = levenshtein(item.lower, queryLower);
                    if (distance <= 2 && distance < queryLower.length) {
                        results.push({
                            type: 'member',
                            className: item.className,
                            name: item.name,
                            typeName: item.type,
                            offset: item.offset,
                            score: 15 - distance * 5,
                            matchField: 'name',
                            query: query,
                            fuzzy: true
                        });
                    }
                });
            }
        }

        // Sort by score (descending) then by type priority (class > member)
        results.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            if (a.type === 'class' && b.type === 'member') return -1;
            if (a.type === 'member' && b.type === 'class') return 1;
            return 0;
        });

        // Limit results
        results = results.slice(0, MAX_RESULTS);

        const queryTime = performance.now() - startTime;
        currentResults = results;
        focusedIndex = -1;

        renderResults(results);
        updateStatus(`${results.length} result${results.length !== 1 ? 's' : ''}`, queryTime);
    }

    /**
     * Score a match between text and query
     */
    function scoreMatch(text, query) {
        if (text === query) return 100; // Exact match
        if (text.startsWith(query)) return 80; // Prefix match
        if (text.includes(query)) return 50; // Substring match
        return 0;
    }

    /**
     * Score a match for offset (hex values)
     */
    function scoreOffsetMatch(offset, query) {
        if (!offset || !query) return 0;
        
        // Remove '0x' prefix for comparison
        const cleanOffset = offset.replace(/^0x/i, '').toLowerCase();
        const cleanQuery = query.replace(/^0x/i, '').toLowerCase();
        
        if (cleanOffset === cleanQuery) return 90; // Exact hex match
        if (cleanOffset.includes(cleanQuery)) return 40; // Substring hex match
        return 0;
    }

    /**
     * Render search results
     */
    function renderResults(results) {
        const resultsDiv = document.getElementById('ASResults');
        if (!resultsDiv) return;

        if (results.length === 0) {
            resultsDiv.innerHTML = '<div class="ASNoResults">No results found</div>';
            return;
        }

        resultsDiv.innerHTML = '';
        results.forEach((result, index) => {
            const item = document.createElement('div');
            item.className = 'ASResultItem';
            item.dataset.index = index;

            if (result.type === 'class') {
                item.innerHTML = `
                    <div class="ASResultType">Class</div>
                    <div class="ASResultName">${highlightMatch(result.name, result.query)}</div>
                    ${result.fuzzy ? '<div class="ASResultFuzzy">Fuzzy match</div>' : ''}
                `;
            } else {
                const matchIndicator = result.matchField === 'offset' ? '(offset match)' : 
                                      result.matchField === 'type' ? '(type match)' : '';
                item.innerHTML = `
                    <div class="ASResultType">Member</div>
                    <div class="ASResultClass">${escapeHtml(result.className)}</div>
                    <div class="ASResultDetails">
                        <span class="ASResultName">${highlightMatch(result.name, result.matchField === 'name' ? result.query : '')}</span>
                        <span class="ASResultTypeName">${highlightMatch(result.typeName, result.matchField === 'type' ? result.query : '')}</span>
                        <span class="ASResultOffset">${highlightMatch(result.offset, result.matchField === 'offset' ? result.query : '')}</span>
                        ${matchIndicator ? `<span class="ASResultMatchType">${matchIndicator}</span>` : ''}
                    </div>
                    ${result.fuzzy ? '<div class="ASResultFuzzy">Fuzzy match</div>' : ''}
                `;
            }

            item.addEventListener('click', () => {
                navigateToResult(result);
            });

            resultsDiv.appendChild(item);
        });
    }

    /**
     * Highlight matching text
     */
    function highlightMatch(text, query) {
        if (!text) return '';
        if (!query) return escapeHtml(text);

        const escapedText = escapeHtml(text);
        const lowerText = text.toLowerCase();
        const lowerQuery = query.toLowerCase();
        
        // Remove 0x prefix for offset matching
        const cleanText = lowerText.replace(/^0x/i, '');
        const cleanQuery = lowerQuery.replace(/^0x/i, '');
        
        let index = cleanText.indexOf(cleanQuery);
        if (index === -1) {
            index = lowerText.indexOf(lowerQuery);
        } else {
            // Adjust index for 0x prefix
            if (lowerText.startsWith('0x')) {
                index += 2;
            }
        }

        if (index === -1) return escapedText;

        const before = escapedText.substring(0, index);
        const match = escapedText.substring(index, index + query.length);
        const after = escapedText.substring(index + query.length);

        return `${before}<span class="ASHighlight">${match}</span>${after}`;
    }

    /**
     * Navigate to a search result
     */
    function navigateToResult(result) {
        if (result.type === 'class') {
            // Navigate to class
            if (window.SelectClass) {
                window.SelectClass(result.name);
            }
        } else if (result.type === 'member') {
            // Navigate to class containing the member
            if (window.SelectClass) {
                window.SelectClass(result.className);
                
                // Highlight the member row after a short delay
                setTimeout(() => {
                    highlightMemberInTable(result.name, result.offset);
                }, 100);
            }
        }

        closeAdvancedSearch();
    }

    /**
     * Highlight a member in the members table
     */
    function highlightMemberInTable(memberName, memberOffset) {
        const rows = document.querySelectorAll('#MembersTableBody tr');
        
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 3) {
                const nameCell = cells[1].textContent;
                const offsetCell = cells[2].textContent;
                
                if (nameCell === memberName || offsetCell === memberOffset) {
                    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    row.style.backgroundColor = 'rgba(99, 102, 241, 0.3)';
                    row.style.transition = 'background-color 0.3s ease';
                    
                    setTimeout(() => {
                        row.style.backgroundColor = '';
                    }, 2000);
                }
            }
        });
    }

    /**
     * Handle keyboard navigation
     */
    function handleKeyboardNavigation(e) {
        if (currentResults.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            focusedIndex = Math.min(focusedIndex + 1, currentResults.length - 1);
            updateFocusedResult();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            focusedIndex = Math.max(focusedIndex - 1, -1);
            updateFocusedResult();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (focusedIndex >= 0 && focusedIndex < currentResults.length) {
                navigateToResult(currentResults[focusedIndex]);
            }
        }
    }

    /**
     * Update the focused result visual state
     */
    function updateFocusedResult() {
        const items = document.querySelectorAll('.ASResultItem');
        items.forEach((item, index) => {
            if (index === focusedIndex) {
                item.classList.add('ASResultFocused');
                item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            } else {
                item.classList.remove('ASResultFocused');
            }
        });
    }

    /**
     * Update status footer
     */
    function updateStatus(message, queryTime) {
        const statusDiv = document.getElementById('ASStatus');
        if (!statusDiv) return;

        if (queryTime !== undefined) {
            statusDiv.textContent = `${message} in ${queryTime.toFixed(1)}ms`;
        } else {
            statusDiv.textContent = message;
        }
    }

    /**
     * Escape HTML to prevent injection
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Debounce function
     */
    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    /**
     * Levenshtein distance (reuse from loader.js if available, otherwise implement)
     */
    function levenshtein(a, b) {
        // Check if global function exists
        if (window.levenshtein && typeof window.levenshtein === 'function') {
            return window.levenshtein(a, b);
        }

        // Fallback implementation
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

    // Export functions to window
    window.AdvancedSearch = {
        initIndex: initIndex,
        open: openAdvancedSearch,
        close: closeAdvancedSearch
    };

    // Auto-initialize if Classes already exists
    if (window.Classes && Object.keys(window.Classes).length > 0) {
        initIndex(window.Classes);
    }
})();
