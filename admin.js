document.addEventListener("DOMContentLoaded", () => {

    // ==========================================================
    // SETTINGS TABLE HELPERS (generic key/value store used for
    // seo, appearance and media-library data, since those don't
    // have dedicated tables in the schema)
    // ==========================================================
    async function getSetting(key) {
        try {
            const doc = await db.collection("settings").doc(key).get();
            if (doc.exists) {
                return doc.data().value;
            }
            return null;
        } catch (error) {
            console.error("Error loading setting " + key + ":", error);
            return null;
        }
    }

    async function saveSetting(key, value) {
        try {
            await db.collection("settings").doc(key).set({ value }, { merge: true });
            return true;
        } catch (error) {
            alert("Error saving settings: " + error.message);
            return false;
        }
    }

    function setButtonLoading(btn, isLoading, loadingText = "Saving...") {
        if (!btn) return;
        if (isLoading) {
            btn.dataset.originalText = btn.textContent;
            btn.textContent = loadingText;
            btn.disabled = true;
        } else {
            if (btn.dataset.originalText) btn.textContent = btn.dataset.originalText;
            btn.disabled = false;
        }
    }

    // 2. AUTHENTICATION & LOGIN GATE
    const loginForm = document.getElementById("login-form");
    const loginOverlay = document.getElementById("login-overlay");
    const loginError = document.getElementById("login-error-msg");

    // Firebase Auth State Listener (replaces checkAuth and onAuthStateChange)
    auth.onAuthStateChanged((user) => {
        if (user) {
            loginOverlay.classList.remove("active");
            if (!window.dashboardInitialized) {
                window.dashboardInitialized = true;
                initializeDashboard();
            }
        } else {
            window.dashboardInitialized = false;
            loginOverlay.classList.add("active");
        }
    });

    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const user = document.getElementById("login-username").value;
            const pass = document.getElementById("login-password").value;
            const submitBtn = loginForm.querySelector('button[type="submit"]');
            setButtonLoading(submitBtn, true, "Signing in...");

            try {
                if (typeof auth === "undefined") {
                    throw new Error("Firebase auth client is not initialized.");
                }

                await auth.signInWithEmailAndPassword(user, pass);
                loginError.style.display = "none";
            } catch (err) {
                console.error("Login error:", err);
                loginError.textContent = err.message || "Invalid username or password.";
                loginError.style.display = "flex";
                const card = document.querySelector(".login-card");
                card.style.animation = "shake 0.3s ease";
                setTimeout(() => { card.style.animation = ""; }, 300);
            } finally {
                setButtonLoading(submitBtn, false);
            }
        });
    }

    const logoutTrigger = document.getElementById("logout-trigger");
    if (logoutTrigger) {
        logoutTrigger.addEventListener("click", async () => {
            try {
                await auth.signOut();
                window.location.reload();
            } catch (err) {
                alert("Error logging out: " + err.message);
            }
        });
    }

    // 3. SPA ROUTING & VIEW SWITCHER
    const menuLinks = document.querySelectorAll(".menu-item-link");
    const views = document.querySelectorAll(".admin-view");
    const viewTitle = document.getElementById("header-view-title");
    const viewSub = document.getElementById("header-view-sub");
    const sidebar = document.querySelector(".admin-sidebar");
    const mobileToggle = document.getElementById("mobile-sidebar-toggle");

    // Title mapping for headers
    const viewMeta = {
        "dashboard": { title: "Welcome back, Deepak! 👋", sub: "Here's what's happening with your portfolio today." },
        "profile": { title: "Personal Biography", sub: "Configure core profile listings and credentials." },
        "projects": { title: "Portfolio Projects", sub: "CRUD operations on featured projects grids." },
        "project-details": { title: "Project Customizations", sub: "Customize links, tags, and settings of individual projects." },
        "skills": { title: "Technologies & Skills", sub: "Configure categories and visual icons of tech items." },
        "experience": { title: "Professional History", sub: "Maintain internships, full time positions, and descriptions." },
        "education": { title: "Academic Background", sub: "List universities, degrees, and grades." },
        "certificates": { title: "Certifications", sub: "Manage credential IDs and cloud certs." },
        "blog": { title: "Blog Articles", sub: "Add draft or published articles." },
        "testimonials": { title: "Client Testimonials", sub: "Manage user reviews and layout settings." },
        "messages": { title: "Contact Messages Inbox", sub: "View contact form queries." },
        "media": { title: "Media Library Assets", sub: "Upload and list static file locations." },
        "analytics": { title: "Traffic & Performance Analytics", sub: "Monitor bounce rate, unique sessions, and counts." },
        "seo": { title: "SEO Optimization", sub: "Update metadata tags for browser indexing." },
        "appearance": { title: "Styling Themes", sub: "Tailor HSL color styles and accents." },
        "settings": { title: "System Settings", sub: "Modify credentials and admin setup." }
    };

    function switchView(viewId) {
        // Toggle view blocks
        views.forEach(v => {
            if (v.id === `view-${viewId}`) {
                v.classList.add("active");
            } else {
                v.classList.remove("active");
            }
        });

        // Toggle active menu highlight
        menuLinks.forEach(link => {
            if (link.getAttribute("data-view") === viewId) {
                link.classList.add("active");
            } else {
                link.classList.remove("active");
            }
        });

        // Update titles
        const meta = viewMeta[viewId] || { title: "Portfolio Admin Console", sub: "Manage website components." };
        viewTitle.textContent = meta.title;
        viewSub.textContent = meta.sub;

        // Populate dynamic views on switch
        if (viewId === "dashboard") renderDashboardData();
        else if (viewId === "projects") renderProjectsTable();
        else if (viewId === "project-details") populateProjectDetailsForm();
        else if (viewId === "skills") renderSkillsTable();
        else if (viewId === "experience") renderExperienceTable();
        else if (viewId === "education") renderEducationTable();
        else if (viewId === "certificates") renderCertificatesTable();
        else if (viewId === "blog") renderBlogTable();
        else if (viewId === "testimonials") renderTestimonialsTable();
        else if (viewId === "messages") renderMessagesTable();
        else if (viewId === "media") renderMediaGrid();
        else if (viewId === "profile") populateProfileForm();
        else if (viewId === "seo") populateSEOForm();
        else if (viewId === "appearance") populateAppearanceForm();
        else if (viewId === "settings") populateSettingsForm();

        // Close sidebar on mobile
        sidebar.classList.remove("open");
    }

    menuLinks.forEach(link => {
        link.addEventListener("click", () => {
            const targetView = link.getAttribute("data-view");
            switchView(targetView);
        });
    });

    // Shortcut routing inside pages (e.g. "View All" buttons)
    document.querySelectorAll("[data-goto-view]").forEach(btn => {
        btn.addEventListener("click", () => {
            const target = btn.getAttribute("data-goto-view");
            switchView(target);
        });
    });

    // Mobile sidebar hamburger
    if (mobileToggle) {
        mobileToggle.addEventListener("click", () => {
            sidebar.classList.toggle("open");
        });
    }

    // 4. CHART RENDERING ENGINE (Visitor graphs and metrics)
    let visitorChartInstance = null;
    let sparksChartInstances = [];

    function initializeCharts() {
        // Destroy existing if any
        if (visitorChartInstance) visitorChartInstance.destroy();
        sparksChartInstances.forEach(inst => inst.destroy());
        sparksChartInstances = [];

        // Common config defaults
        Chart.defaults.color = '#8e9fa0';
        Chart.defaults.borderColor = 'rgba(0, 255, 204, 0.04)';
        Chart.defaults.font.family = 'Inter, sans-serif';

        // 1. Visitor Analytics Large Line Chart
        const visitorCtx = document.getElementById("chart-visitor-analytics");
        if (visitorCtx) {
            visitorChartInstance = new Chart(visitorCtx, {
                type: 'line',
                data: {
                    labels: ['20 May', '22 May', '24 May', '26 May', '28 May', '30 May', '01 Jun', '03 Jun', '05 Jun', '07 Jun', '09 Jun', '11 Jun', '13 Jun', '15 Jun', '17 Jun'],
                    datasets: [{
                        label: 'Visitors',
                        data: [750, 920, 810, 1150, 950, 1200, 1050, 1380, 1100, 1420, 1310, 1842, 1290, 1450, 1380],
                        borderColor: '#00ffcc',
                        borderWidth: 2,
                        backgroundColor: 'rgba(0, 255, 204, 0.05)',
                        fill: true,
                        tension: 0.4,
                        pointBackgroundColor: '#00ffcc',
                        pointHoverRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: {
                            min: 0,
                            max: 2000,
                            ticks: { stepSize: 500 }
                        }
                    }
                }
            });
        }

        // 2. Large Extended Traffic Analysis Chart
        const largeCtx = document.getElementById("chart-analytics-large");
        if (largeCtx) {
            new Chart(largeCtx, {
                type: 'line',
                data: {
                    labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6'],
                    datasets: [
                        {
                            label: 'Total Sessions',
                            data: [4200, 5800, 5200, 7100, 6800, 8400],
                            borderColor: '#00ffcc',
                            borderWidth: 3,
                            backgroundColor: 'rgba(0, 255, 204, 0.04)',
                            fill: true,
                            tension: 0.35
                        },
                        {
                            label: 'Unique Visitors',
                            data: [3100, 4200, 3900, 5400, 4900, 6200],
                            borderColor: '#3b82f6',
                            borderWidth: 2,
                            backgroundColor: 'rgba(59, 130, 246, 0.02)',
                            fill: true,
                            tension: 0.35
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });
        }

        // 3. Sparkline Minicharts for Metrics
        const sparkIds = [
            { id: 'chart-spark-visitors', data: [12, 19, 15, 25, 22, 30, 28], color: '#00ffcc' },
            { id: 'chart-spark-projects', data: [5, 6, 7, 7, 9, 10, 12], color: '#22c55e' },
            { id: 'chart-spark-blogs', data: [10, 11, 13, 14, 14, 16, 18], color: '#3b82f6' },
            { id: 'chart-spark-messages', data: [15, 22, 19, 28, 26, 30, 32], color: '#a855f7' },
            { id: 'chart-spark-downloads', data: [80, 95, 110, 105, 120, 135, 156], color: '#00ffcc' },
            { id: 'chart-spark-stars', data: [350, 380, 410, 425, 450, 465, 487], color: '#22c55e' }
        ];

        sparkIds.forEach(spark => {
            const ctx = document.getElementById(spark.id);
            if (ctx) {
                const inst = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: [1, 2, 3, 4, 5, 6, 7],
                        datasets: [{
                            data: spark.data,
                            borderColor: spark.color,
                            borderWidth: 1.5,
                            fill: false,
                            tension: 0.4,
                            pointRadius: 0
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false }, tooltip: { enabled: false } },
                        scales: {
                            x: { display: false },
                            y: { display: false }
                        }
                    }
                });
                sparksChartInstances.push(inst);
            }
        });
    }

    // 5. DATA RENDERERS AND CRUD CONTROLLERS

    // Dashboard View Render
    async function renderDashboardData() {
        try {
            const projSnapshot = await db.collection("projects").orderBy("created_at", "asc").get();
            const projects = projSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            const msgSnapshot = await db.collection("contact_messages").orderBy("created_at", "asc").get();
            const messages = msgSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Counters
        document.getElementById("dash-projects-count").textContent = projects.length;
        document.getElementById("dash-messages-count").textContent = messages.length;
        document.getElementById("messages-count-badge").textContent = messages.filter(m => !m.read).length;

        // Recent Projects list
        const projList = document.getElementById("dash-projects-list");
        if (projList) {
            projList.innerHTML = "";
            const latestProjects = projects.slice(-5).reverse();
            latestProjects.forEach(proj => {
                const statusClass = proj.status === "Published" ? "published" : "draft";
                const dotColor = proj.status === "Published" ? "#22c55e" : "#8e9fa0";

                projList.innerHTML += `
                    <div class="recent-proj-item">
                        <img src="${proj.image}" alt="${proj.title}" class="recent-proj-thumb">
                        <div class="recent-proj-info">
                            <div class="proj-meta-header">
                                <h4>${proj.title}</h4>
                                <span class="status-badge ${statusClass}">
                                    <span class="status-dot-static" style="background-color: ${dotColor};"></span>
                                    <span>${proj.status}</span>
                                </span>
                            </div>
                            <span class="recent-proj-tech">${proj.tech}</span>
                        </div>
                        <div class="recent-proj-date-box">
                            <span class="recent-proj-date">${proj.date || 'May 2024'}</span>
                            <span class="recent-proj-views"><i data-lucide="eye" class="icon-xs"></i> ${(proj.views || 0).toLocaleString()}</span>
                        </div>
                        <button class="btn-options-dots" onclick="editProjectRow('${proj.id}')">
                            <i data-lucide="edit-2" class="icon-sm"></i>
                        </button>
                    </div>
                `;
            });
        }

        // Recent Messages list
        const msgList = document.getElementById("dash-messages-list");
        if (msgList) {
            msgList.innerHTML = "";
            const latestMessages = messages.slice(-3).reverse();
            latestMessages.forEach(msg => {
                const readDot = msg.read ? "" : `<span class="status-dot-green inline"></span>`;
                msgList.innerHTML += `
                    <div class="dash-msg-item" onclick="openMessageDetail('${msg.id}')" style="cursor:pointer">
                        <div class="feed-icon bg-cyan"><i data-lucide="user"></i></div>
                        <div class="dash-msg-details">
                            <div class="dash-msg-header">
                                <span class="dash-msg-sender">${msg.name} ${readDot}</span>
                                <span class="dash-msg-time">${msg.date}</span>
                            </div>
                            <span class="dash-msg-subject">${msg.subject}</span>
                            <p class="dash-msg-text">${msg.message}</p>
                        </div>
                    </div>
                `;
            });
        }
        lucide.createIcons();
        } catch (error) {
            alert("Error loading dashboard data: " + error.message);
        }
    }

    // Projects CRUD
    const projForm = document.getElementById("project-modal-form");
    const projModal = document.getElementById("modal-project");

    async function renderProjectsTable() {
        try {
            const snapshot = await db.collection("projects").orderBy("created_at", "asc").get();
            const projects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            const tbody = document.querySelector("#projects-table tbody");
            if (tbody) {
                tbody.innerHTML = "";
                projects.forEach(proj => {
                    const statusClass = proj.status === "Published" ? "published" : "draft";
                    const dotColor = proj.status === "Published" ? "#22c55e" : "#8e9fa0";

                    tbody.innerHTML += `
                        <tr>
                            <td>
                                <div class="table-proj-cell">
                                    <img src="${proj.image}" alt="" class="table-proj-thumb">
                                    <div class="table-proj-info">
                                        <span class="table-proj-title">${proj.title}</span>
                                        <span class="table-proj-tech">${proj.tech}</span>
                                    </div>
                                </div>
                            </td>
                            <td>
                                <span class="status-badge ${statusClass}" onclick="toggleProjectStatus('${proj.id}')" style="cursor:pointer">
                                    <span class="status-dot-static" style="background-color: ${dotColor};"></span>
                                    <span>${proj.status}</span>
                                </span>
                            </td>
                            <td>${proj.date || 'May 2024'}</td>
                            <td>${(proj.views || 0).toLocaleString()}</td>
                            <td>
                                <div class="table-actions-cell">
                                    <button class="btn-icon edit" onclick="editProjectRow('${proj.id}')" title="Edit"><i data-lucide="edit-3" class="icon-sm"></i></button>
                                    <button class="btn-icon delete" onclick="deleteProjectRow('${proj.id}')" title="Delete"><i data-lucide="trash-2" class="icon-sm"></i></button>
                                </div>
                            </td>
                        </tr>
                    `;
                });
            }
            lucide.createIcons();
        } catch (error) {
            alert("Error loading projects: " + error.message);
        }
    }

    window.toggleProjectStatus = async function(id) {
        try {
            const docRef = db.collection("projects").doc(id);
            const doc = await docRef.get();
            if (!doc.exists) {
                alert("Project not found!");
                return;
            }
            const currentStatus = doc.data().status;
            const newStatus = currentStatus === "Published" ? "Draft" : "Published";
            await docRef.update({ status: newStatus });
            renderProjectsTable();
            window.dispatchEvent(new Event('storage'));
        } catch (error) {
            alert("Error updating status: " + error.message);
        }
    };

    window.deleteProjectRow = async function(id) {
        if (confirm("Are you sure you want to delete this project?")) {
            try {
                await db.collection("projects").doc(id).delete();
                renderProjectsTable();
                window.dispatchEvent(new Event('storage'));
            } catch (error) {
                alert("Error deleting project: " + error.message);
            }
        }
    };

    window.editProjectRow = async function(id) {
        try {
            const doc = await db.collection("projects").doc(id).get();
            if (!doc.exists) {
                alert("Project not found!");
                return;
            }
            const proj = doc.data();
            document.getElementById("project-modal-title").textContent = "Edit Project";
            document.getElementById("modal-project-id").value = id;
            document.getElementById("modal-project-title").value = proj.title;
            document.getElementById("modal-project-desc").value = proj.description;
            document.getElementById("modal-project-tech").value = proj.tech;
            document.getElementById("modal-project-image").value = proj.image;
            document.getElementById("modal-project-status").value = proj.status;
            document.getElementById("modal-project-link").value = proj.link || "";

            projModal.classList.add("active");
        } catch (error) {
            alert("Error loading project: " + error.message);
        }
    };

    if (projForm) {
        projForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const submitBtn = projForm.querySelector('button[type="submit"]');
            setButtonLoading(submitBtn, true);

            const id = document.getElementById("modal-project-id").value;
            const title = document.getElementById("modal-project-title").value;
            const desc = document.getElementById("modal-project-desc").value;
            const tech = document.getElementById("modal-project-tech").value;
            const image = document.getElementById("modal-project-image").value;
            const status = document.getElementById("modal-project-status").value;
            const link = document.getElementById("modal-project-link").value;

            try {
                if (id) {
                    await db.collection("projects").doc(id).update({
                        title: title,
                        description: desc,
                        tech: tech,
                        tags: tech.split(",").map(t => t.trim()),
                        image: image,
                        status: status,
                        link: link
                    });
                } else {
                    await db.collection("projects").add({
                        title: title,
                        description: desc,
                        tech: tech,
                        tags: tech.split(",").map(t => t.trim()),
                        image: image,
                        status: status,
                        link: link,
                        views: 0,
                        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                        created_at: Date.now()
                    });
                }

                projModal.classList.remove("active");
                projForm.reset();
                renderProjectsTable();
                window.dispatchEvent(new Event('storage'));
            } catch (error) {
                alert("Error saving project: " + error.message);
            } finally {
                setButtonLoading(submitBtn, false);
            }
        });
    }

    document.getElementById("btn-add-project-modal").addEventListener("click", () => {
        document.getElementById("project-modal-title").textContent = "Add New Project";
        document.getElementById("modal-project-id").value = "";
        projForm.reset();
        projModal.classList.add("active");
    });

    document.getElementById("modal-project-close").addEventListener("click", () => { projModal.classList.remove("active"); });
    document.getElementById("modal-project-cancel").addEventListener("click", () => { projModal.classList.remove("active"); });

    // Project Details Config Form
    async function populateProjectDetailsForm() {
        try {
            const snapshot = await db.collection("projects").orderBy("created_at", "asc").get();
            const projects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const select = document.getElementById("detail-project-select");
            if (select) {
                select.innerHTML = "";
                projects.forEach(p => {
                    select.innerHTML += `<option value="${p.id}">${p.title}</option>`;
                });

                // Trigger detail load
                loadSelectedProjectDetails();
            }
        } catch (error) {
            alert("Error loading projects: " + error.message);
        }
    }

    const projectSelect = document.getElementById("detail-project-select");
    if (projectSelect) {
        projectSelect.addEventListener("change", loadSelectedProjectDetails);
    }

    async function loadSelectedProjectDetails() {
        const id = document.getElementById("detail-project-select").value;
        if (!id) return;
        try {
            const doc = await db.collection("projects").doc(id).get();
            if (doc.exists) {
                const proj = doc.data();
                document.getElementById("detail-project-link").value = proj.link || "";
                document.getElementById("detail-project-tags").value = proj.tags ? proj.tags.join(", ") : "";
            }
        } catch (error) {
            alert("Error loading project details: " + error.message);
        }
    }

    const detailForm = document.getElementById("project-detail-form");
    if (detailForm) {
        detailForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const submitBtn = detailForm.querySelector('button[type="submit"]');
            setButtonLoading(submitBtn, true);

            const id = document.getElementById("detail-project-select").value;
            const link = document.getElementById("detail-project-link").value;
            const tags = document.getElementById("detail-project-tags").value;

            try {
                await db.collection("projects").doc(id).update({
                    link: link,
                    tags: tags.split(",").map(t => t.trim())
                });
                alert("Project specifications updated successfully!");
                window.dispatchEvent(new Event('storage'));
            } catch (error) {
                alert("Error updating project specifications: " + error.message);
            } finally {
                setButtonLoading(submitBtn, false);
            }
        });
    }

    // Skills CRUD
    const skillModal = document.getElementById("modal-skill");
    const skillForm = document.getElementById("skill-modal-form");

    async function renderSkillsTable() {
        try {
            const snapshot = await db.collection("skills").orderBy("created_at", "asc").get();
            const skills = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            const tbody = document.querySelector("#skills-table tbody");
            if (tbody) {
                tbody.innerHTML = "";
                skills.forEach(skill => {
                    tbody.innerHTML += `
                        <tr>
                            <td><div class="btn-icon text-cyan"><i data-lucide="${skill.icon || 'code-2'}"></i></div></td>
                            <td><strong>${skill.title}</strong></td>
                            <td>${skill.description}</td>
                            <td>
                                <div class="table-actions-cell">
                                    <button class="btn-icon edit" onclick="editSkillRow('${skill.id}')"><i data-lucide="edit-3" class="icon-sm"></i></button>
                                    <button class="btn-icon delete" onclick="deleteSkillRow('${skill.id}')"><i data-lucide="trash-2" class="icon-sm"></i></button>
                                </div>
                            </td>
                        </tr>
                    `;
                });
            }
            lucide.createIcons();
        } catch (error) {
            alert("Error loading skills: " + error.message);
        }
    }

    window.deleteSkillRow = async function(id) {
        if (confirm("Are you sure you want to delete this skill?")) {
            try {
                await db.collection("skills").doc(id).delete();
                renderSkillsTable();
                window.dispatchEvent(new Event('storage'));
            } catch (error) {
                alert("Error deleting skill: " + error.message);
            }
        }
    };

    window.editSkillRow = async function(id) {
        try {
            const doc = await db.collection("skills").doc(id).get();
            if (!doc.exists) {
                alert("Skill not found!");
                return;
            }
            const s = doc.data();
            document.getElementById("skill-modal-title").textContent = "Edit Skill";
            document.getElementById("modal-skill-id").value = id;
            document.getElementById("modal-skill-category").value = s.title;
            document.getElementById("modal-skill-desc").value = s.description;
            document.getElementById("modal-skill-icon").value = s.icon;
            skillModal.classList.add("active");
        } catch (error) {
            alert("Error loading skill: " + error.message);
        }
    };

    if (skillForm) {
        skillForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const submitBtn = skillForm.querySelector('button[type="submit"]');
            setButtonLoading(submitBtn, true);

            const id = document.getElementById("modal-skill-id").value;
            const category = document.getElementById("modal-skill-category").value;
            const desc = document.getElementById("modal-skill-desc").value;
            const icon = document.getElementById("modal-skill-icon").value;

            try {
                if (id) {
                    await db.collection("skills").doc(id).update({
                        title: category,
                        description: desc,
                        icon: icon
                    });
                } else {
                    await db.collection("skills").add({
                        title: category,
                        description: desc,
                        icon: icon,
                        created_at: Date.now()
                    });
                }

                skillModal.classList.remove("active");
                renderSkillsTable();
                window.dispatchEvent(new Event('storage'));
            } catch (error) {
                alert("Error saving skill: " + error.message);
            } finally {
                setButtonLoading(submitBtn, false);
            }
        });
    }

    document.getElementById("btn-add-skill-modal").addEventListener("click", () => {
        document.getElementById("skill-modal-title").textContent = "Add New Skill";
        document.getElementById("modal-skill-id").value = "";
        skillForm.reset();
        skillModal.classList.add("active");
    });
    document.getElementById("modal-skill-close").addEventListener("click", () => { skillModal.classList.remove("active"); });
    document.getElementById("modal-skill-cancel").addEventListener("click", () => { skillModal.classList.remove("active"); });

    // Testimonials CRUD
    const testimonialModal = document.getElementById("modal-testimonial");
    const testimonialForm = document.getElementById("testimonial-modal-form");

    async function renderTestimonialsTable() {
        try {
            const snapshot = await db.collection("testimonials").orderBy("created_at", "asc").get();
            const testimonials = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            const tbody = document.querySelector("#testimonials-table tbody");
            if (tbody) {
                tbody.innerHTML = "";
                testimonials.forEach(test => {
                    tbody.innerHTML += `
                        <tr>
                            <td><strong>${test.author}</strong><br><span style="font-size:0.75rem">${test.title}</span></td>
                            <td><p style="font-style:italic; max-width: 400px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap">"${test.text}"</p></td>
                            <td>
                                <div class="table-actions-cell">
                                    <button class="btn-icon edit" onclick="editTestimonialRow('${test.id}')"><i data-lucide="edit-3" class="icon-sm"></i></button>
                                    <button class="btn-icon delete" onclick="deleteTestimonialRow('${test.id}')"><i data-lucide="trash-2" class="icon-sm"></i></button>
                                </div>
                            </td>
                        </tr>
                    `;
                });
            }
            lucide.createIcons();
        } catch (error) {
            alert("Error loading testimonials: " + error.message);
        }
    }

    window.deleteTestimonialRow = async function(id) {
        if (confirm("Are you sure you want to delete this testimonial?")) {
            try {
                await db.collection("testimonials").doc(id).delete();
                renderTestimonialsTable();
                window.dispatchEvent(new Event('storage'));
            } catch (error) {
                alert("Error deleting testimonial: " + error.message);
            }
        }
    };

    window.editTestimonialRow = async function(id) {
        try {
            const doc = await db.collection("testimonials").doc(id).get();
            if (!doc.exists) {
                alert("Testimonial not found!");
                return;
            }
            const t = doc.data();
            document.getElementById("testimonial-modal-title").textContent = "Edit Testimonial";
            document.getElementById("modal-testimonial-id").value = id;
            document.getElementById("modal-test-author").value = t.author;
            document.getElementById("modal-test-title").value = t.title;
            document.getElementById("modal-test-text").value = t.text;
            testimonialModal.classList.add("active");
        } catch (error) {
            alert("Error loading testimonial: " + error.message);
        }
    };

    if (testimonialForm) {
        testimonialForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const submitBtn = testimonialForm.querySelector('button[type="submit"]');
            setButtonLoading(submitBtn, true);

            const id = document.getElementById("modal-testimonial-id").value;
            const author = document.getElementById("modal-test-author").value;
            const title = document.getElementById("modal-test-title").value;
            const text = document.getElementById("modal-test-text").value;

            try {
                if (id) {
                    await db.collection("testimonials").doc(id).update({
                        author: author,
                        title: title,
                        text: text
                    });
                } else {
                    await db.collection("testimonials").add({
                        author: author,
                        title: title,
                        text: text,
                        created_at: Date.now()
                    });
                }

                testimonialModal.classList.remove("active");
                renderTestimonialsTable();
                window.dispatchEvent(new Event('storage'));
            } catch (error) {
                alert("Error saving testimonial: " + error.message);
            } finally {
                setButtonLoading(submitBtn, false);
            }
        });
    }

    document.getElementById("btn-add-testimonial-modal").addEventListener("click", () => {
        document.getElementById("testimonial-modal-title").textContent = "Add New Testimonial";
        document.getElementById("modal-testimonial-id").value = "";
        testimonialForm.reset();
        testimonialModal.classList.add("active");
    });
    document.getElementById("modal-testimonial-close").addEventListener("click", () => { testimonialModal.classList.remove("active"); });
    document.getElementById("modal-testimonial-cancel").addEventListener("click", () => { testimonialModal.classList.remove("active"); });

    // Contact messages inbox reader
    const msgModal = document.getElementById("modal-message");
    async function renderMessagesTable() {
        try {
            const snapshot = await db.collection("contact_messages").orderBy("created_at", "asc").get();
            const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            const tbody = document.querySelector("#messages-table tbody");
            if (tbody) {
                tbody.innerHTML = "";
                messages.forEach(msg => {
                    const readClass = msg.read ? "read" : "unread";
                    const readLabel = msg.read ? "Read" : "Unread";
                    tbody.innerHTML += `
                        <tr>
                            <td>
                                <strong>${msg.name}</strong><br>
                                <span style="font-size:0.75rem">${msg.email}</span>
                            </td>
                            <td>
                                <span class="read-badge ${readClass}">${readLabel}</span>
                                <span style="font-weight:600; color:var(--text-primary); margin-left:0.5rem">${msg.subject}</span> - 
                                <span style="font-size:0.85rem">${msg.message.substring(0, 50)}...</span>
                            </td>
                            <td>${msg.date}</td>
                            <td>
                                <div class="table-actions-cell">
                                    <button class="btn-icon edit" onclick="openMessageDetail('${msg.id}')" title="View"><i data-lucide="eye" class="icon-sm"></i></button>
                                    <button class="btn-icon delete" onclick="deleteMessageRow('${msg.id}')" title="Delete"><i data-lucide="trash-2" class="icon-sm"></i></button>
                                </div>
                            </td>
                        </tr>
                    `;
                });
            }
            lucide.createIcons();
        } catch (error) {
            alert("Error loading messages: " + error.message);
        }
    }

    window.deleteMessageRow = async function(id) {
        if (confirm("Are you sure you want to delete this message?")) {
            try {
                await db.collection("contact_messages").doc(id).delete();
                renderMessagesTable();
                renderDashboardData();
            } catch (error) {
                alert("Error deleting message: " + error.message);
            }
        }
    };

    let activeViewingMessageId = null;
    window.openMessageDetail = async function(id) {
        try {
            const docRef = db.collection("contact_messages").doc(id);
            await docRef.update({ read: true });

            const doc = await docRef.get();
            if (!doc.exists) {
                alert("Message not found!");
                return;
            }
            const msg = doc.data();

            activeViewingMessageId = id;
            document.getElementById("msg-view-name").textContent = msg.name;
            document.getElementById("msg-view-email").textContent = msg.email;
            document.getElementById("msg-view-date").textContent = msg.date;
            document.getElementById("msg-view-subject").textContent = msg.subject;
            document.getElementById("msg-view-text").textContent = msg.message;
            document.getElementById("msg-reply-text").value = "";

            msgModal.classList.add("active");
            renderMessagesTable();
            renderDashboardData();
        } catch (error) {
            alert("Error loading message: " + error.message);
        }
    };

    document.getElementById("modal-message-close").addEventListener("click", () => { msgModal.classList.remove("active"); });
    document.getElementById("modal-message-cancel").addEventListener("click", () => { msgModal.classList.remove("active"); });

    document.getElementById("btn-send-reply").addEventListener("click", () => {
        const replyText = document.getElementById("msg-reply-text").value;
        if (!replyText.trim()) {
            alert("Please enter response text.");
            return;
        }
        alert("Simulated Email Response Sent successfully!");
        msgModal.classList.remove("active");
    });

    // Profile Form Persistence
    async function populateProfileForm() {
        const user = auth.currentUser;
        if (!user) {
            alert("Error loading current user: No session");
            return;
        }

        try {
            const doc = await db.collection("profiles").doc(user.uid).get();
            if (doc.exists) {
                const profile = doc.data();
                document.getElementById("prof-name").value = profile.name || "";
                document.getElementById("prof-title").value = profile.title || "";
                document.getElementById("prof-bio").value = profile.bio || "";
                document.getElementById("prof-about-bio").value = profile.about_bio || "";
                document.getElementById("prof-education").value = profile.education || "";
                document.getElementById("prof-specialization").value = profile.specialization || "";
                document.getElementById("prof-location").value = profile.location || "";
                document.getElementById("prof-email").value = profile.email || "";
                document.getElementById("prof-avatar").value = profile.avatar || "";
                document.getElementById("prof-stat-projects").value = profile.stat_projects || "15+";
                document.getElementById("prof-stat-experience").value = profile.stat_experience || "1+";
                document.getElementById("prof-stat-problems").value = profile.stat_problems || "1000+";
                document.getElementById("prof-stat-commits").value = profile.stat_commits || "800+";
            }
        } catch (error) {
            alert("Error loading profile: " + error.message);
        }
    }

    const profileForm = document.getElementById("profile-form");
    if (profileForm) {
        profileForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const submitBtn = profileForm.querySelector('button[type="submit"]');
            setButtonLoading(submitBtn, true);

            const user = auth.currentUser;
            if (!user) {
                setButtonLoading(submitBtn, false);
                alert("Error loading current user: No session");
                return;
            }

            const profile = {
                id: user.uid,
                name: document.getElementById("prof-name").value,
                title: document.getElementById("prof-title").value,
                bio: document.getElementById("prof-bio").value,
                about_bio: document.getElementById("prof-about-bio").value,
                education: document.getElementById("prof-education").value,
                specialization: document.getElementById("prof-specialization").value,
                location: document.getElementById("prof-location").value,
                email: document.getElementById("prof-email").value,
                avatar: document.getElementById("prof-avatar").value,
                stat_projects: document.getElementById("prof-stat-projects").value,
                stat_experience: document.getElementById("prof-stat-experience").value,
                stat_problems: document.getElementById("prof-stat-problems").value,
                stat_commits: document.getElementById("prof-stat-commits").value
            };

            try {
                await db.collection("profiles").doc(user.uid).set(profile, { merge: true });
                alert("Biography profile saved successfully!");
                window.dispatchEvent(new Event('storage'));
            } catch (error) {
                alert("Error saving profile: " + error.message);
            } finally {
                setButtonLoading(submitBtn, false);
            }
        });
    }

    // Experience CRUD
    async function renderExperienceTable() {
        try {
            const snapshot = await db.collection("experience").orderBy("created_at", "asc").get();
            const exp = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            const tbody = document.querySelector("#exp-table tbody");
            if (tbody) {
                tbody.innerHTML = "";
                exp.forEach(e => {
                    tbody.innerHTML += `
                        <tr>
                            <td><strong>${e.company}</strong><br><span style="font-size:0.75rem">${e.title}</span></td>
                            <td>${e.duration}</td>
                            <td><span style="font-size:0.85rem">${e.description}</span></td>
                            <td>
                                <div class="table-actions-cell">
                                    <button class="btn-icon delete" onclick="deleteExperienceRow('${e.id}')"><i data-lucide="trash-2" class="icon-sm"></i></button>
                                </div>
                            </td>
                        </tr>
                    `;
                });
            }
            lucide.createIcons();
        } catch (error) {
            alert("Error loading experience: " + error.message);
        }
    }

    window.deleteExperienceRow = async function(id) {
        if (confirm("Are you sure?")) {
            try {
                await db.collection("experience").doc(id).delete();
                renderExperienceTable();
            } catch (error) {
                alert("Error deleting experience: " + error.message);
            }
        }
    };

    document.getElementById("btn-add-exp-modal").addEventListener("click", async () => {
        const company = prompt("Enter Company:");
        const title = prompt("Enter Title:");
        const duration = prompt("Enter Duration (e.g. Jan 2022 - May 2023):");
        const desc = prompt("Enter Short Description:");
        if (company && title) {
            try {
                await db.collection("experience").add({
                    company: company,
                    title: title,
                    duration: duration,
                    description: desc,
                    created_at: Date.now()
                });
                renderExperienceTable();
            } catch (error) {
                alert("Error adding experience: " + error.message);
            }
        }
    });

    // Education CRUD
    async function renderEducationTable() {
        try {
            const snapshot = await db.collection("education").orderBy("created_at", "asc").get();
            const edu = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            const tbody = document.querySelector("#edu-table tbody");
            if (tbody) {
                tbody.innerHTML = "";
                edu.forEach(e => {
                    tbody.innerHTML += `
                        <tr>
                            <td><strong>${e.school}</strong><br><span style="font-size:0.75rem">${e.degree}</span></td>
                            <td>${e.duration}</td>
                            <td><span style="font-size:0.85rem">${e.details}</span></td>
                            <td>
                                <div class="table-actions-cell">
                                    <button class="btn-icon delete" onclick="deleteEducationRow('${e.id}')"><i data-lucide="trash-2" class="icon-sm"></i></button>
                                </div>
                            </td>
                        </tr>
                    `;
                });
            }
            lucide.createIcons();
        } catch (error) {
            alert("Error loading education: " + error.message);
        }
    }

    window.deleteEducationRow = async function(id) {
        if (confirm("Are you sure?")) {
            try {
                await db.collection("education").doc(id).delete();
                renderEducationTable();
            } catch (error) {
                alert("Error deleting education: " + error.message);
            }
        }
    };

    document.getElementById("btn-add-edu-modal").addEventListener("click", async () => {
        const school = prompt("Enter School/Institution:");
        const degree = prompt("Enter Degree:");
        const duration = prompt("Enter Duration:");
        const details = prompt("Enter Grades/Details:");
        if (school && degree) {
            try {
                await db.collection("education").add({
                    school: school,
                    degree: degree,
                    duration: duration,
                    details: details,
                    created_at: Date.now()
                });
                renderEducationTable();
            } catch (error) {
                alert("Error adding education: " + error.message);
            }
        }
    });

    // Certificates CRUD
    async function renderCertificatesTable() {
        try {
            const snapshot = await db.collection("certificates").orderBy("created_at", "asc").get();
            const certs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            const tbody = document.querySelector("#certs-table tbody");
            if (tbody) {
                tbody.innerHTML = "";
                certs.forEach(c => {
                    tbody.innerHTML += `
                        <tr>
                            <td><strong>${c.title}</strong><br><span style="font-size:0.75rem">${c.issuer}</span></td>
                            <td>${c.date}</td>
                            <td><code style="font-size:0.8rem">${c.credential_id}</code></td>
                            <td>
                                <div class="table-actions-cell">
                                    <button class="btn-icon delete" onclick="deleteCertificateRow('${c.id}')"><i data-lucide="trash-2" class="icon-sm"></i></button>
                                </div>
                            </td>
                        </tr>
                    `;
                });
            }
            lucide.createIcons();
        } catch (error) {
            alert("Error loading certificates: " + error.message);
        }
    }

    window.deleteCertificateRow = async function(id) {
        if (confirm("Are you sure?")) {
            try {
                await db.collection("certificates").doc(id).delete();
                renderCertificatesTable();
            } catch (error) {
                alert("Error deleting certificate: " + error.message);
            }
        }
    };

    document.getElementById("btn-add-cert-modal").addEventListener("click", async () => {
        const title = prompt("Enter Certificate Title:");
        const issuer = prompt("Enter Issuer:");
        const date = prompt("Enter Date:");
        const credId = prompt("Enter Credential ID:");
        if (title && issuer) {
            try {
                await db.collection("certificates").add({
                    title: title,
                    issuer: issuer,
                    date: date,
                    credential_id: credId,
                    created_at: Date.now()
                });
                renderCertificatesTable();
            } catch (error) {
                alert("Error adding certificate: " + error.message);
            }
        }
    });

    // Blog CRUD
    async function renderBlogTable() {
        try {
            const snapshot = await db.collection("blogs").orderBy("created_at", "asc").get();
            const blogs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            const tbody = document.querySelector("#blog-table tbody");
            if (tbody) {
                tbody.innerHTML = "";
                blogs.forEach(b => {
                    const statusClass = b.status === "Published" ? "published" : "draft";
                    tbody.innerHTML += `
                        <tr>
                            <td><strong>${b.title}</strong></td>
                            <td><span class="status-badge ${statusClass}">${b.status}</span></td>
                            <td>${b.date}</td>
                            <td>${b.views || 0}</td>
                            <td>
                                <div class="table-actions-cell">
                                    <button class="btn-icon delete" onclick="deleteBlogRow('${b.id}')"><i data-lucide="trash-2" class="icon-sm"></i></button>
                                </div>
                            </td>
                        </tr>
                    `;
                });
            }
            lucide.createIcons();
        } catch (error) {
            alert("Error loading blog posts: " + error.message);
        }
    }

    window.deleteBlogRow = async function(id) {
        if (confirm("Are you sure?")) {
            try {
                await db.collection("blogs").doc(id).delete();
                renderBlogTable();
            } catch (error) {
                alert("Error deleting blog post: " + error.message);
            }
        }
    };

    document.getElementById("btn-add-blog-modal").addEventListener("click", async () => {
        const title = prompt("Enter Article Title:");
        if (title) {
            try {
                await db.collection("blogs").add({
                    title: title,
                    status: "Published",
                    date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                    views: 0,
                    created_at: Date.now()
                });
                renderBlogTable();
            } catch (error) {
                alert("Error adding blog post: " + error.message);
            }
        }
    });

    // Media Library Grid (stored as a JSON array under the "media" key
    // in the settings table since there is no dedicated media table)
    async function renderMediaGrid() {
        const media = (await getSetting("media")) || [];
        const grid = document.getElementById("media-assets-grid");
        if (grid) {
            grid.innerHTML = "";
            media.forEach(item => {
                grid.innerHTML += `
                    <div class="media-item">
                        <img src="${item.url}" alt="" class="media-img">
                        <div class="media-actions-overlay">
                            <button class="btn-icon delete" onclick="deleteMediaItem('${item.id}')" title="Delete"><i data-lucide="trash-2" class="icon-sm"></i></button>
                        </div>
                    </div>
                `;
            });
        }
        lucide.createIcons();
    }

    window.deleteMediaItem = async function(id) {
        if (confirm("Are you sure you want to delete this media item?")) {
            const media = (await getSetting("media")) || [];
            const filtered = media.filter(m => m.id !== id);
            const ok = await saveSetting("media", filtered);
            if (ok) renderMediaGrid();
        }
    };

    document.getElementById("btn-media-add").addEventListener("click", async () => {
        const url = prompt("Enter image asset link (e.g. assets/dashboard.png):");
        if (url) {
            const media = (await getSetting("media")) || [];
            media.push({ id: Date.now().toString(), url: url });
            const ok = await saveSetting("media", media);
            if (ok) renderMediaGrid();
        }
    });

    // SEO Form Config (stored under the "seo" key in the settings table)
    async function populateSEOForm() {
        const seo = await getSetting("seo");
        if (seo) {
            document.getElementById("seo-title").value = seo.title || "";
            document.getElementById("seo-desc").value = seo.desc || "";
            document.getElementById("seo-keywords").value = seo.keywords || "";
        }
    }

    const seoForm = document.getElementById("seo-form");
    if (seoForm) {
        seoForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const submitBtn = seoForm.querySelector('button[type="submit"]');
            setButtonLoading(submitBtn, true);

            const seo = {
                title: document.getElementById("seo-title").value,
                desc: document.getElementById("seo-desc").value,
                keywords: document.getElementById("seo-keywords").value
            };
            const ok = await saveSetting("seo", seo);

            setButtonLoading(submitBtn, false);

            if (ok) alert("SEO metadata settings updated successfully!");
        });
    }

    // Appearance Palette Form (stored under the "appearance" key in settings)
    async function populateAppearanceForm() {
        const appColors = await getSetting("appearance");
        if (appColors) {
            document.getElementById("theme-primary").value = appColors.primary;
            document.getElementById("theme-bg").value = appColors.bg;
        }
    }

    const appForm = document.getElementById("appearance-form");
    if (appForm) {
        appForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const submitBtn = appForm.querySelector('button[type="submit"]');
            setButtonLoading(submitBtn, true);

            const appColors = {
                primary: document.getElementById("theme-primary").value,
                bg: document.getElementById("theme-bg").value
            };
            const ok = await saveSetting("appearance", appColors);

            setButtonLoading(submitBtn, false);

            if (ok) alert("Theme settings saved! Color palette variables persisted.");
        });
    }

    // Settings Credentials Form (uses Firebase Auth directly, since these
    // are the actual admin login credentials rather than app data)
    async function populateSettingsForm() {
        const user = auth.currentUser;
        if (user) {
            document.getElementById("set-username").value = user.email || "";
            document.getElementById("set-password").value = "";
        }
    }

    const settingsForm = document.getElementById("settings-form");
    if (settingsForm) {
        settingsForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const submitBtn = settingsForm.querySelector('button[type="submit"]');
            setButtonLoading(submitBtn, true);

            const userEmail = document.getElementById("set-username").value;
            const pass = document.getElementById("set-password").value;

            try {
                const user = auth.currentUser;
                if (!user) {
                    throw new Error("No authenticated user session found.");
                }

                if (userEmail && userEmail !== user.email) {
                    await user.updateEmail(userEmail);
                }
                if (pass) {
                    await user.updatePassword(pass);
                }
                alert("System settings saved! Admin login credentials updated.");
            } catch (error) {
                alert("Error updating credentials: " + error.message);
            } finally {
                setButtonLoading(submitBtn, false);
            }
        });
    }

    // Database Seeding Helper
    async function clearCollection(collectionName) {
        const snapshot = await db.collection(collectionName).get();
        const deletePromises = snapshot.docs.map(doc => doc.ref.delete());
        await Promise.all(deletePromises);
    }

    async function seedDatabase() {
        const btn = document.getElementById("btn-seed-db");
        if (!btn) return;

        if (!confirm("Are you sure you want to seed the database with premium mock content? This will OVERWRITE your current portfolio data (projects, skills, experience, testimonials, education, certificates, blogs, settings, and profile details).")) {
            return;
        }

        setButtonLoading(btn, true, "Seeding Database...");

        try {
            const user = auth.currentUser;
            if (!user) {
                throw new Error("No authenticated user session found. Please log in first.");
            }

            // 1. Clear existing collections
            const collections = ["projects", "skills", "experience", "testimonials", "education", "certificates", "blogs"];
            for (const col of collections) {
                await clearCollection(col);
            }

            // 2. Seed Profile
            await db.collection("profiles").doc(user.uid).set({
                name: "Deepak Choudhary",
                title: "Full-Stack Software Engineer & Solutions Architect",
                bio: "Building high-performance, secure, and beautiful web applications that drive real business value. Specializing in JavaScript/TypeScript, React, Node.js, and Cloud Architectures.",
                about_bio: "I am a passionate software developer who loves bridging the gap between design and technology. With years of experience writing clean, scalable code, I build modern digital interfaces that are fast, accessible, and delightful to use. I am constantly learning new technologies to solve complex engineering challenges and optimize system performance.",
                avatar: "assets/profile.png",
                education: "B.Tech in Computer Science",
                specialization: "Full Stack Web & Cloud Development",
                location: "Delhi, India",
                email: user.email || "deepak@example.com",
                stat_projects: "18+",
                stat_experience: "2+",
                stat_problems: "1200+",
                stat_commits: "950+"
            }, { merge: true });

            // 3. Seed Projects
            const sampleProjects = [
                {
                    title: "AeroDrive: Cloud Management Platform",
                    description: "A comprehensive SaaS dashboard designed to monitor cloud resource utilization, track billing metrics, and optimize multi-tenant infrastructure using interactive data visualizations.",
                    tech: "React, Node.js, Express, Chart.js, TailwindCSS",
                    tags: ["React", "Node.js", "Chart.js", "TailwindCSS"],
                    image: "assets/dashboard.png",
                    status: "Published",
                    link: "https://github.com",
                    views: 142,
                    date: "Jul 2026",
                    created_at: Date.now() - 30 * 24 * 60 * 60 * 1000
                },
                {
                    title: "StepStride: Premium Sneaker E-Commerce",
                    description: "A premium sneaker store featuring 3D model previews, a smooth cart/checkout process, user-personalized recommendations, and a responsive mobile-first UI.",
                    tech: "Vanilla JS, CSS Grid, HTML5, LocalStorage",
                    tags: ["Vanilla JS", "CSS Grid", "HTML5", "LocalStorage"],
                    image: "assets/shoe-store.png",
                    status: "Published",
                    link: "https://github.com",
                    views: 98,
                    date: "May 2026",
                    created_at: Date.now() - 60 * 24 * 60 * 60 * 1000
                },
                {
                    title: "ZenWorkspace: Minimalist Productivity Tool",
                    description: "A minimalist workspace application supporting task kanban boards, markdown note-taking, pomodoro timers, and Spotify ambient sound integration.",
                    tech: "React, Firebase, Tailwind CSS, Lucide Icons",
                    tags: ["React", "Firebase", "Tailwind CSS", "Lucide Icons"],
                    image: "assets/workspace.png",
                    status: "Published",
                    link: "https://github.com",
                    views: 215,
                    date: "Mar 2026",
                    created_at: Date.now() - 90 * 24 * 60 * 60 * 1000
                }
            ];
            for (const proj of sampleProjects) {
                await db.collection("projects").add(proj);
            }

            // 4. Seed Skills
            const sampleSkills = [
                {
                    title: "Frontend Development",
                    description: "Crafting beautiful, responsive, and accessible user interfaces using React, Vue, HTML5, CSS3, and JavaScript/TypeScript.",
                    icon: "layout",
                    created_at: Date.now() - 5000
                },
                {
                    title: "Backend Systems",
                    description: "Architecting secure, scalable, and optimized RESTful and GraphQL APIs using Node.js, Express, Python, and Go.",
                    icon: "server",
                    created_at: Date.now() - 4000
                },
                {
                    title: "Cloud & DevOps",
                    description: "Deploying and managing microservices on GCP and AWS, setting up robust CI/CD pipelines, and writing Dockerfiles.",
                    icon: "cloud",
                    created_at: Date.now() - 3000
                },
                {
                    title: "Database Systems",
                    description: "Designing normalized schemas and writing efficient queries for relational databases (PostgreSQL, MySQL) and NoSQL (MongoDB, Firestore).",
                    icon: "database",
                    created_at: Date.now() - 2000
                }
            ];
            for (const skill of sampleSkills) {
                await db.collection("skills").add(skill);
            }

            // 5. Seed Experience
            const sampleExp = [
                {
                    company: "Google Summer of Code",
                    title: "Open Source Contributor",
                    duration: "May 2025 - Aug 2025",
                    description: "Contributed to cloud orchestration tools, optimized container runtime networking, and fixed major performance issues in legacy modules.",
                    created_at: Date.now() - 10000
                },
                {
                    company: "InnovaTech Solutions",
                    title: "Junior Software Engineer",
                    duration: "Sep 2024 - Present",
                    description: "Maintained core internal services, developed new customer checkout features, and improved site-wide performance and accessibility.",
                    created_at: Date.now() - 8000
                }
            ];
            for (const exp of sampleExp) {
                await db.collection("experience").add(exp);
            }

            // 6. Seed Education
            const sampleEdu = [
                {
                    school: "Delhi Technical University",
                    degree: "Bachelor of Technology in Computer Science & Engineering",
                    duration: "2021 - 2025",
                    details: "GPA: 9.2/10. Relevant Coursework: Data Structures, Algorithms, DBMS, Operating Systems, Computer Networks.",
                    created_at: Date.now() - 10000
                },
                {
                    school: "St. Xavier Senior Secondary School",
                    degree: "High School Diploma",
                    duration: "2019 - 2021",
                    details: "Percentage: 96.5% (Science Stream with Computer Science).",
                    created_at: Date.now() - 8000
                }
            ];
            for (const edu of sampleEdu) {
                await db.collection("education").add(edu);
            }

            // 7. Seed Certificates
            const sampleCerts = [
                {
                    title: "Google Cloud Certified Professional Cloud Architect",
                    issuer: "Google Cloud",
                    date: "Jan 2026",
                    credential_id: "GCP-PCA-987412",
                    created_at: Date.now() - 10000
                },
                {
                    title: "AWS Certified Developer – Associate",
                    issuer: "Amazon Web Services",
                    date: "Nov 2025",
                    credential_id: "AWS-CDA-335198",
                    created_at: Date.now() - 8000
                }
            ];
            for (const cert of sampleCerts) {
                await db.collection("certificates").add(cert);
            }

            // 8. Seed Testimonials
            const sampleTestimonials = [
                {
                    author: "Sarah Jenkins",
                    title: "CEO, InnovaTech",
                    text: "Deepak is an outstanding engineer. He delivered our product ahead of schedule and with clean, well-tested code. His communication was great throughout the project.",
                    created_at: Date.now() - 10000
                },
                {
                    author: "Michael Chen",
                    title: "Product Manager, TechVibe",
                    text: "Working with Deepak was a pleasure. He took our complex product specs and turned them into a smooth, high-fidelity experience that our users absolutely love.",
                    created_at: Date.now() - 8000
                }
            ];
            for (const test of sampleTestimonials) {
                await db.collection("testimonials").add(test);
            }

            // 9. Seed Blogs
            const sampleBlogs = [
                {
                    title: "Mastering Clean Code in JavaScript",
                    status: "Published",
                    date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                    views: 42,
                    created_at: Date.now() - 10000
                }
            ];
            for (const blog of sampleBlogs) {
                await db.collection("blogs").add(blog);
            }

            // 10. Seed Settings
            await db.collection("settings").doc("seo").set({
                value: {
                    title: "Deepak Choudhary | Portfolio",
                    desc: "Explore the personal portfolio of Deepak Choudhary, featuring projects, skills, professional experience, and certifications.",
                    keywords: "Deepak Choudhary, Software Engineer, Portfolio, Developer, React, Node.js"
                }
            }, { merge: true });

            await db.collection("settings").doc("appearance").set({
                value: {
                    primary: "#00ffcc",
                    bg: "#0f172a"
                }
            }, { merge: true });

            alert("Database seeded successfully! All tables and collections are fully initialized.");
            
            // Reload the admin state and views to display the new content
            window.location.reload();
        } catch (error) {
            alert("Error seeding database: " + error.message);
            console.error("Seeding error:", error);
        } finally {
            setButtonLoading(btn, false);
        }
    }

    const seedBtn = document.getElementById("btn-seed-db");
    if (seedBtn) {
        seedBtn.addEventListener("click", seedDatabase);
    }

    // Initialize SPA state on authentication
    function initializeDashboard() {
        switchView("dashboard");
        initializeCharts();
    }
});