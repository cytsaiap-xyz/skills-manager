/**
 * Skill Manager - Frontend JavaScript
 */

// State
let skills = [];
let categories = [];
let installedSkills = { global: [], project: [] };
let currentSkill = null;
let activeInstalledTab = 'global';
let searchQuery = '';
let selectedCategory = 'all';

// DOM Elements
const skillsGrid = document.getElementById('skillsGrid');
const emptyState = document.getElementById('emptyState');
const noResultsState = document.getElementById('noResultsState');
const skillModal = document.getElementById('skillModal');
const modalTitle = document.getElementById('modalTitle');
const modalDescription = document.getElementById('modalDescription');
const modalFiles = document.getElementById('modalFiles');
const modalDownloadBtn = document.getElementById('modalDownloadBtn');
const toastContainer = document.getElementById('toastContainer');
const projectPathSection = document.getElementById('projectPathSection');
const projectPathInput = document.getElementById('projectPath');
const installedGlobalGrid = document.getElementById('installedGlobalGrid');
const installedProjectGrid = document.getElementById('installedProjectGrid');
const globalBadge = document.getElementById('globalBadge');
const projectBadge = document.getElementById('projectBadge');
const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearchBtn');
const categoryFilters = document.getElementById('categoryFilters');
const filterStatus = document.getElementById('filterStatus');
const filterStatusText = document.getElementById('filterStatusText');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadSkills();
    loadConfig();
    loadInstalledSkills();
    setupEventListeners();
});

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // Destination radio buttons
    document.querySelectorAll('input[name="destination"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            projectPathSection.style.display = e.target.value === 'project' ? 'block' : 'none';
            // Reload installed skills when switching destinations
            loadInstalledSkills();
        });
    });

    // Project path input - reload installed skills when path changes
    let projectPathTimeout;
    projectPathInput.addEventListener('input', () => {
        clearTimeout(projectPathTimeout);
        projectPathTimeout = setTimeout(() => {
            loadInstalledSkills();
        }, 500);
    });

    // Modal download button
    modalDownloadBtn.addEventListener('click', () => {
        if (currentSkill) {
            downloadSkill(currentSkill.id);
        }
    });

    // Close modal on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal();
        }
    });
}

/**
 * Load configuration
 */
async function loadConfig() {
    try {
        const response = await fetch('/api/config');
        const data = await response.json();

        if (data.success) {
            document.getElementById('globalPath').textContent = data.config.globalSkillsPath;
        }
    } catch (error) {
        console.error('Error loading config:', error);
    }
}

/**
 * Load installed skills
 */
async function loadInstalledSkills() {
    try {
        const projectPath = projectPathInput.value;
        let url = '/api/installed?type=all';
        if (projectPath) {
            url += `&projectPath=${encodeURIComponent(projectPath)}`;
        }

        const response = await fetch(url);
        const data = await response.json();

        if (data.success) {
            installedSkills = data.installed;
            renderInstalledSkills();
            // Re-render available skills to update installed badges
            renderSkills();
        }
    } catch (error) {
        console.error('Error loading installed skills:', error);
    }
}

/**
 * Switch installed skills tab
 */
function switchInstalledTab(tab) {
    activeInstalledTab = tab;

    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });

    // Show/hide grids
    installedGlobalGrid.style.display = tab === 'global' ? 'grid' : 'none';
    installedProjectGrid.style.display = tab === 'project' ? 'grid' : 'none';
}

/**
 * Render installed skills
 */
function renderInstalledSkills() {
    // Update badges
    globalBadge.textContent = installedSkills.global.length;
    projectBadge.textContent = installedSkills.project.length;

    // Render global installed skills
    if (installedSkills.global.length === 0) {
        installedGlobalGrid.innerHTML = `
      <div class="empty-state-small">
        <span>No global skills installed</span>
      </div>
    `;
    } else {
        installedGlobalGrid.innerHTML = installedSkills.global.map(skill => `
      <div class="skill-card installed">
        <div class="skill-header">
          <div class="skill-icon">✅</div>
        </div>
        <h3 class="skill-name">${escapeHtml(skill.name)}</h3>
        <p class="skill-description">${escapeHtml(skill.description)}</p>
        <div class="skill-footer">
          <span class="installed-badge">✓ Installed</span>
        </div>
      </div>
    `).join('');
    }

    // Render project installed skills
    if (installedSkills.project.length === 0) {
        const message = projectPathInput.value
            ? 'No project skills installed'
            : 'Enter project path above to see installed skills';
        installedProjectGrid.innerHTML = `
      <div class="empty-state-small">
        <span>${message}</span>
      </div>
    `;
    } else {
        installedProjectGrid.innerHTML = installedSkills.project.map(skill => `
      <div class="skill-card installed">
        <div class="skill-header">
          <div class="skill-icon">✅</div>
        </div>
        <h3 class="skill-name">${escapeHtml(skill.name)}</h3>
        <p class="skill-description">${escapeHtml(skill.description)}</p>
        <div class="skill-footer">
          <span class="installed-badge">✓ Installed</span>
        </div>
      </div>
    `).join('');
    }
}

/**
 * Check if a skill is already installed in the current destination
 */
function isSkillInstalled(skillId) {
    const destination = document.querySelector('input[name="destination"]:checked').value;
    const targetList = destination === 'global' ? installedSkills.global : installedSkills.project;
    return targetList.some(s => s.id === skillId);
}

/**
 * Load all skills from the server
 */
async function loadSkills() {
    try {
        skillsGrid.innerHTML = `
      <div class="loading">
        <div class="spinner"></div>
        <p>Loading skills...</p>
      </div>
    `;
        emptyState.style.display = 'none';
        noResultsState.style.display = 'none';

        const response = await fetch('/api/skills');
        const data = await response.json();

        if (data.success) {
            skills = data.skills;
            categories = data.categories || [];
            renderCategoryFilters();
            renderSkills();
        } else {
            showToast('Failed to load skills', 'error');
        }
    } catch (error) {
        console.error('Error loading skills:', error);
        showToast('Failed to connect to server', 'error');
        skillsGrid.innerHTML = '';
        emptyState.style.display = 'block';
    }
}

/**
 * Render category filter buttons
 */
function renderCategoryFilters() {
    // Count skills per category
    const categoryCounts = { all: skills.length };
    categories.forEach(cat => {
        categoryCounts[cat] = skills.filter(s => s.category === cat).length;
    });

    // Build category buttons HTML
    let html = `
    <button class="category-btn ${selectedCategory === 'all' ? 'active' : ''}" data-category="all" onclick="setCategory('all')">
      All
      <span class="category-count">${categoryCounts.all}</span>
    </button>
  `;

    categories.forEach(cat => {
        const isActive = selectedCategory === cat ? 'active' : '';
        const icon = getCategoryIcon(cat);
        html += `
      <button class="category-btn ${isActive}" data-category="${escapeHtml(cat)}" onclick="setCategory('${escapeHtml(cat)}')">
        ${icon} ${escapeHtml(cat)}
        <span class="category-count">${categoryCounts[cat]}</span>
      </button>
    `;
    });

    categoryFilters.innerHTML = html;
}

/**
 * Get icon for category
 */
function getCategoryIcon(category) {
    const icons = {
        'Development': '💻',
        'Testing': '🧪',
        'Documentation': '📚',
        'DevOps': '🔧',
        'Security': '🔒',
        'AI': '🤖',
        'Database': '🗄️',
        'Frontend': '🎨',
        'Backend': '⚙️',
        'Workflow': '📋',
        'Other': '📦'
    };
    return icons[category] || '📦';
}

/**
 * Set category filter
 */
function setCategory(category) {
    selectedCategory = category;

    // Update active state
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.category === category);
    });

    filterSkills();
}

/**
 * Filter skills based on search query and category
 */
function filterSkills() {
    searchQuery = searchInput.value.toLowerCase().trim();

    // Show/hide clear button
    clearSearchBtn.style.display = searchQuery ? 'flex' : 'none';

    renderSkills();
    updateFilterStatus();
}

/**
 * Clear search input
 */
function clearSearch() {
    searchInput.value = '';
    searchQuery = '';
    clearSearchBtn.style.display = 'none';
    filterSkills();
}

/**
 * Clear all filters
 */
function clearAllFilters() {
    searchInput.value = '';
    searchQuery = '';
    selectedCategory = 'all';
    clearSearchBtn.style.display = 'none';

    // Reset category buttons
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.category === 'all');
    });

    filterSkills();
}

/**
 * Update filter status bar
 */
function updateFilterStatus() {
    const isFiltering = searchQuery || selectedCategory !== 'all';
    filterStatus.style.display = isFiltering ? 'flex' : 'none';

    if (isFiltering) {
        const parts = [];
        if (searchQuery) {
            parts.push(`"${searchQuery}"`);
        }
        if (selectedCategory !== 'all') {
            parts.push(`category: ${selectedCategory}`);
        }

        const filteredCount = getFilteredSkills().length;
        filterStatusText.textContent = `Showing ${filteredCount} skill${filteredCount !== 1 ? 's' : ''} matching ${parts.join(' in ')}`;
    }
}

/**
 * Get filtered skills based on current filters
 */
function getFilteredSkills() {
    return skills.filter(skill => {
        // Category filter
        if (selectedCategory !== 'all' && skill.category !== selectedCategory) {
            return false;
        }

        // Search filter
        if (searchQuery) {
            const searchFields = [
                skill.name.toLowerCase(),
                skill.description.toLowerCase(),
                skill.category.toLowerCase(),
                ...skill.tags.map(t => t.toLowerCase())
            ];
            return searchFields.some(field => field.includes(searchQuery));
        }

        return true;
    });
}

/**
 * Render skills to the grid
 */
function renderSkills() {
    const filteredSkills = getFilteredSkills();

    // Hide empty state by default
    emptyState.style.display = 'none';
    noResultsState.style.display = 'none';

    if (skills.length === 0) {
        skillsGrid.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }

    if (filteredSkills.length === 0) {
        skillsGrid.innerHTML = '';
        noResultsState.style.display = 'block';
        return;
    }

    skillsGrid.innerHTML = filteredSkills.map(skill => {
        const installed = isSkillInstalled(skill.id);
        const downloadBtnClass = installed ? 'btn btn-disabled' : 'btn btn-primary';
        const downloadBtnText = installed ? '✓ Installed' : '⬇️ Download';
        const downloadAction = installed ? '' : `onclick="event.stopPropagation(); downloadSkill('${skill.id}')"`;
        const categoryIcon = getCategoryIcon(skill.category);
        const tagsHtml = skill.tags.length > 0
            ? `<div class="skill-tags">${skill.tags.slice(0, 3).map(t => `<span class="skill-tag">${escapeHtml(t)}</span>`).join('')}</div>`
            : '';

        return `
      <div class="skill-card ${installed ? 'installed' : ''}" onclick="showSkillDetails('${skill.id}')">
        <div class="skill-header">
          <div class="skill-icon">${installed ? '✅' : '🔧'}</div>
          <span class="skill-category">${categoryIcon} ${escapeHtml(skill.category)}</span>
        </div>
        <h3 class="skill-name">${escapeHtml(skill.name)}</h3>
        <p class="skill-description">${escapeHtml(skill.description)}</p>
        ${tagsHtml}
        <div class="skill-footer">
          <button class="btn btn-secondary" onclick="event.stopPropagation(); showSkillDetails('${skill.id}')">
            📄 Details
          </button>
          <button class="${downloadBtnClass}" ${downloadAction}>
            ${downloadBtnText}
          </button>
        </div>
      </div>
    `;
    }).join('');
}

/**
 * Show skill details in modal
 */
async function showSkillDetails(skillId) {
    try {
        const response = await fetch(`/api/skills/${encodeURIComponent(skillId)}`);
        const data = await response.json();

        if (data.success) {
            currentSkill = data.skill;
            modalTitle.textContent = data.skill.name;
            modalDescription.textContent = data.skill.description;

            modalFiles.innerHTML = data.skill.files.map(file => `
        <li>
          <span>${file.isDirectory ? '📁' : '📄'}</span>
          <span>${escapeHtml(file.name)}</span>
        </li>
      `).join('');

            // Update modal download button based on install status
            const installed = isSkillInstalled(skillId);
            modalDownloadBtn.disabled = installed;
            modalDownloadBtn.className = installed ? 'btn btn-disabled' : 'btn btn-primary';
            modalDownloadBtn.innerHTML = installed ? '✓ Already Installed' : '<span>⬇️</span> Download';

            skillModal.classList.add('active');
            document.body.style.overflow = 'hidden';
        } else {
            showToast('Failed to load skill details', 'error');
        }
    } catch (error) {
        console.error('Error loading skill details:', error);
        showToast('Failed to load skill details', 'error');
    }
}

/**
 * Close the modal
 */
function closeModal() {
    skillModal.classList.remove('active');
    document.body.style.overflow = '';
    currentSkill = null;
}

/**
 * Download a skill
 */
async function downloadSkill(skillId) {
    const destination = document.querySelector('input[name="destination"]:checked').value;
    const projectPath = projectPathInput.value;

    // Check if already installed
    if (isSkillInstalled(skillId)) {
        showToast('Skill is already installed in this destination', 'error');
        return;
    }

    // Validate project path if needed
    if (destination === 'project' && !projectPath.trim()) {
        showToast('Please enter a project path', 'error');
        projectPathInput.focus();
        return;
    }

    try {
        const response = await fetch('/api/download', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                skillId,
                destination,
                projectPath: destination === 'project' ? projectPath : undefined
            })
        });

        const data = await response.json();

        if (data.success) {
            showToast(`Skill downloaded to ${data.destination}`, 'success');
            closeModal();
            // Reload installed skills to update the UI
            loadInstalledSkills();
        } else {
            showToast(data.error || 'Download failed', 'error');
        }
    } catch (error) {
        console.error('Error downloading skill:', error);
        showToast('Failed to download skill', 'error');
    }
}

/**
 * Show a toast notification
 */
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
    <span class="toast-icon">${type === 'success' ? '✅' : '❌'}</span>
    <span class="toast-message">${escapeHtml(message)}</span>
  `;

    toastContainer.appendChild(toast);

    // Remove after animation
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
