document.addEventListener("DOMContentLoaded", () => {

    // ==========================================================
    // SETTINGS TABLE HELPERS (generic key/value store used for
    // seo, appearance and media-library data, since those don't
    // have dedicated tables in the schema)
    // ==========================================================
    async function getSetting(key) {
        const { data, error } = await supabase
            .from("settings")
            .select("*")
            .eq("key", key)
            .maybeSingle();
        if (error) {
            alert("Error loading settings: " + error.message);
            return null;
        }
        return data ? data.value : null;
    }

    async function saveSetting(key, value) {
        const { data: existing, error: fetchError } = await supabase
            .from("settings")
            .select("id")
            .eq("key", key)
            .maybeSingle();

        if (fetchError) {
            alert("Error checking settings: " + fetchError.message);
            return false;
        }

        let error;
        if (existing) {
            ({ error } = await supabase.from("settings").update({ value }).eq("key", key));
        } else {
            ({ error } = await supabase.from("settings").insert({ key, value }));
        }

        if (error) {
            alert("Error saving settings: " + error.message);
            return false;
        }
        return true;
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

    async function checkAuth() {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
            console.error(error);
        }
        if (session) {
            loginOverlay.classList.remove("active");
            initializeDashboard();
        } else {
            loginOverlay.classList.add("active");
        }
    }

    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const user = document.getElementById("login-username").value;
            const pass = document.getElementById("login-password").value;
            const submitBtn = loginForm.querySelector('button[type="submit"]');
            setButtonLoading(submitBtn, true, "Signing in...");

            try {
                if (typeof supabase === "undefined") {
                    throw new Error("Supabase client is not initialized (check that supabase.js loads before admin.js).");
                }

                const { data, error } = await supabase.auth.signInWithPassword({
                    email: user,
                    password: pass
                });

                if (error) {
                    console.error("Login error:", error);
                    loginError.textContent = error.message || "Invalid username or password.";
                    loginError.style.display = "flex";
                    const card = document.querySelector(".login-card");
                    card.style.animation = "shake 0.3s ease";
                    setTimeout(() => { card.style.animation = ""; }, 300);
                } else {
                    loginError.style.display = "none";
                    loginOverlay.classList.remove("active");
                    initializeDashboard();
                }
            } catch (err) {
                console.error("Login exception:", err);
                loginError.textContent = err.message || "Something went wrong. Check the console for details.";
                loginError.style.display = "flex";
            } finally {
                setButtonLoading(submitBtn, false);
            }
        });
    }

    const logoutTrigger = document.getElementById("logout-trigger");
    if (logoutTrigger) {
        logoutTrigger.addEventListener("click", async () => {
            const { error } = await supabase.auth.signOut();
            if (error) {
                alert("Error logging out: " + error.message);
                return;
            }
            window.location.reload();
        });
    }

    // React to session expiry / external sign-out
    supabase.auth.onAuthStateChange((event) => {
        if (event === "SIGNED_OUT") {
            loginOverlay.classList.add("active");
        }
    });

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
        const { data: projects, error: projError } = await supabase
            .from("projects")
            .select("*")
            .order("created_at", { ascending: true });
        if (projError) {
            alert("Error loading projects: " + projError.message);
            return;
        }

        const { data: messages, error: msgError } = await supabase
            .from("contact_messages")
            .select("*")
            .order("created_at", { ascending: true });
        if (msgError) {
            alert("Error loading messages: " + msgError.message);
            return;
        }

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
    }

    // Projects CRUD
    const projForm = document.getElementById("project-modal-form");
    const projModal = document.getElementById("modal-project");

    async function renderProjectsTable() {
        const { data: projects, error } = await supabase
            .from("projects")
            .select("*")
            .order("created_at", { ascending: true });
        if (error) {
            alert("Error loading projects: " + error.message);
            return;
        }

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
    }

    window.toggleProjectStatus = async function(id) {
        const { data: proj, error: fetchError } = await supabase
            .from("projects")
            .select("status")
            .eq("id", id)
            .single();
        if (fetchError) {
            alert("Error loading project: " + fetchError.message);
            return;
        }
        const newStatus = proj.status === "Published" ? "Draft" : "Published";
        const { error } = await supabase.from("projects").update({ status: newStatus }).eq("id", id);
        if (error) {
            alert("Error updating status: " + error.message);
            return;
        }
        renderProjectsTable();
        window.dispatchEvent(new Event('storage'));
    };

    window.deleteProjectRow = async function(id) {
        if (confirm("Are you sure you want to delete this project?")) {
            const { error } = await supabase.from("projects").delete().eq("id", id);
            if (error) {
                alert("Error deleting project: " + error.message);
                return;
            }
            renderProjectsTable();
            window.dispatchEvent(new Event('storage'));
        }
    };

    window.editProjectRow = async function(id) {
        const { data: proj, error } = await supabase.from("projects").select("*").eq("id", id).single();
        if (error) {
            alert("Error loading project: " + error.message);
            return;
        }
        if (proj) {
            document.getElementById("project-modal-title").textContent = "Edit Project";
            document.getElementById("modal-project-id").value = proj.id;
            document.getElementById("modal-project-title").value = proj.title;
            document.getElementById("modal-project-desc").value = proj.description;
            document.getElementById("modal-project-tech").value = proj.tech;
            document.getElementById("modal-project-image").value = proj.image;
            document.getElementById("modal-project-status").value = proj.status;
            document.getElementById("modal-project-link").value = proj.link || "";

            projModal.classList.add("active");
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

            let error;
            if (id) {
                ({ error } = await supabase
                    .from("projects")
                    .update({
                        title: title,
                        description: desc,
                        tech: tech,
                        tags: tech.split(",").map(t => t.trim()),
                        image: image,
                        status: status,
                        link: link
                    })
                    .eq("id", id));
            } else {
                ({ error } = await supabase.from("projects").insert({
                    title: title,
                    description: desc,
                    tech: tech,
                    tags: tech.split(",").map(t => t.trim()),
                    image: image,
                    status: status,
                    link: link,
                    views: 0,
                    date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                }));
            }

            setButtonLoading(submitBtn, false);

            if (error) {
                alert("Error saving project: " + error.message);
                return;
            }

            projModal.classList.remove("active");
            projForm.reset();
            renderProjectsTable();
            window.dispatchEvent(new Event('storage'));
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
        const { data: projects, error } = await supabase
            .from("projects")
            .select("*")
            .order("created_at", { ascending: true });
        if (error) {
            alert("Error loading projects: " + error.message);
            return;
        }
        const select = document.getElementById("detail-project-select");
        if (select) {
            select.innerHTML = "";
            projects.forEach(p => {
                select.innerHTML += `<option value="${p.id}">${p.title}</option>`;
            });

            // Trigger detail load
            loadSelectedProjectDetails();
        }
    }

    const projectSelect = document.getElementById("detail-project-select");
    if (projectSelect) {
        projectSelect.addEventListener("change", loadSelectedProjectDetails);
    }

    async function loadSelectedProjectDetails() {
        const id = document.getElementById("detail-project-select").value;
        if (!id) return;
        const { data: proj, error } = await supabase.from("projects").select("*").eq("id", id).single();
        if (error) {
            alert("Error loading project details: " + error.message);
            return;
        }
        if (proj) {
            document.getElementById("detail-project-link").value = proj.link || "";
            document.getElementById("detail-project-tags").value = proj.tags ? proj.tags.join(", ") : "";
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

            const { error } = await supabase
                .from("projects")
                .update({
                    link: link,
                    tags: tags.split(",").map(t => t.trim())
                })
                .eq("id", id);

            setButtonLoading(submitBtn, false);

            if (error) {
                alert("Error updating project specifications: " + error.message);
                return;
            }

            alert("Project specifications updated successfully!");
            window.dispatchEvent(new Event('storage'));
        });
    }

    // Skills CRUD
    const skillModal = document.getElementById("modal-skill");
    const skillForm = document.getElementById("skill-modal-form");

    async function renderSkillsTable() {
        const { data: skills, error } = await supabase
            .from("skills")
            .select("*")
            .order("created_at", { ascending: true });
        if (error) {
            alert("Error loading skills: " + error.message);
            return;
        }
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
    }

    window.deleteSkillRow = async function(id) {
        if (confirm("Are you sure you want to delete this skill?")) {
            const { error } = await supabase.from("skills").delete().eq("id", id);
            if (error) {
                alert("Error deleting skill: " + error.message);
                return;
            }
            renderSkillsTable();
            window.dispatchEvent(new Event('storage'));
        }
    };

    window.editSkillRow = async function(id) {
        const { data: s, error } = await supabase.from("skills").select("*").eq("id", id).single();
        if (error) {
            alert("Error loading skill: " + error.message);
            return;
        }
        if (s) {
            document.getElementById("skill-modal-title").textContent = "Edit Skill";
            document.getElementById("modal-skill-id").value = s.id;
            document.getElementById("modal-skill-category").value = s.title;
            document.getElementById("modal-skill-desc").value = s.description;
            document.getElementById("modal-skill-icon").value = s.icon;
            skillModal.classList.add("active");
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

            let error;
            if (id) {
                ({ error } = await supabase
                    .from("skills")
                    .update({ title: category, description: desc, icon: icon })
                    .eq("id", id));
            } else {
                ({ error } = await supabase
                    .from("skills")
                    .insert({ title: category, description: desc, icon: icon }));
            }

            setButtonLoading(submitBtn, false);

            if (error) {
                alert("Error saving skill: " + error.message);
                return;
            }

            skillModal.classList.remove("active");
            renderSkillsTable();
            window.dispatchEvent(new Event('storage'));
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
        const { data: testimonials, error } = await supabase
            .from("testimonials")
            .select("*")
            .order("created_at", { ascending: true });
        if (error) {
            alert("Error loading testimonials: " + error.message);
            return;
        }
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
    }

    window.deleteTestimonialRow = async function(id) {
        if (confirm("Are you sure you want to delete this testimonial?")) {
            const { error } = await supabase.from("testimonials").delete().eq("id", id);
            if (error) {
                alert("Error deleting testimonial: " + error.message);
                return;
            }
            renderTestimonialsTable();
            window.dispatchEvent(new Event('storage'));
        }
    };

    window.editTestimonialRow = async function(id) {
        const { data: t, error } = await supabase.from("testimonials").select("*").eq("id", id).single();
        if (error) {
            alert("Error loading testimonial: " + error.message);
            return;
        }
        if (t) {
            document.getElementById("testimonial-modal-title").textContent = "Edit Testimonial";
            document.getElementById("modal-testimonial-id").value = t.id;
            document.getElementById("modal-test-author").value = t.author;
            document.getElementById("modal-test-title").value = t.title;
            document.getElementById("modal-test-text").value = t.text;
            testimonialModal.classList.add("active");
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

            let error;
            if (id) {
                ({ error } = await supabase
                    .from("testimonials")
                    .update({ author: author, title: title, text: text })
                    .eq("id", id));
            } else {
                ({ error } = await supabase
                    .from("testimonials")
                    .insert({ author: author, title: title, text: text }));
            }

            setButtonLoading(submitBtn, false);

            if (error) {
                alert("Error saving testimonial: " + error.message);
                return;
            }

            testimonialModal.classList.remove("active");
            renderTestimonialsTable();
            window.dispatchEvent(new Event('storage'));
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
        const { data: messages, error } = await supabase
            .from("contact_messages")
            .select("*")
            .order("created_at", { ascending: true });
        if (error) {
            alert("Error loading messages: " + error.message);
            return;
        }
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
    }

    window.deleteMessageRow = async function(id) {
        if (confirm("Are you sure you want to delete this message?")) {
            const { error } = await supabase.from("contact_messages").delete().eq("id", id);
            if (error) {
                alert("Error deleting message: " + error.message);
                return;
            }
            renderMessagesTable();
            renderDashboardData();
        }
    };

    let activeViewingMessageId = null;
    window.openMessageDetail = async function(id) {
        const { error: updateError } = await supabase
            .from("contact_messages")
            .update({ read: true })
            .eq("id", id);
        if (updateError) {
            alert("Error updating message: " + updateError.message);
            return;
        }

        const { data: msg, error } = await supabase
            .from("contact_messages")
            .select("*")
            .eq("id", id)
            .single();
        if (error) {
            alert("Error loading message: " + error.message);
            return;
        }

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
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
            alert("Error loading current user: " + (userError ? userError.message : "No session"));
            return;
        }

        const { data: profile, error } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .maybeSingle();

        if (error) {
            alert("Error loading profile: " + error.message);
            return;
        }

        if (profile) {
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
    }

    const profileForm = document.getElementById("profile-form");
    if (profileForm) {
        profileForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const submitBtn = profileForm.querySelector('button[type="submit"]');
            setButtonLoading(submitBtn, true);

            const { data: { user }, error: userError } = await supabase.auth.getUser();
            if (userError || !user) {
                setButtonLoading(submitBtn, false);
                alert("Error loading current user: " + (userError ? userError.message : "No session"));
                return;
            }

            const profile = {
                id: user.id,
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

            const { error } = await supabase.from("profiles").upsert(profile);

            setButtonLoading(submitBtn, false);

            if (error) {
                alert("Error saving profile: " + error.message);
                return;
            }

            alert("Biography profile saved successfully!");
            window.dispatchEvent(new Event('storage'));
        });
    }

    // Experience CRUD
    async function renderExperienceTable() {
        const { data: exp, error } = await supabase
            .from("experience")
            .select("*")
            .order("created_at", { ascending: true });
        if (error) {
            alert("Error loading experience: " + error.message);
            return;
        }
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
    }

    window.deleteExperienceRow = async function(id) {
        if (confirm("Are you sure?")) {
            const { error } = await supabase.from("experience").delete().eq("id", id);
            if (error) {
                alert("Error deleting experience: " + error.message);
                return;
            }
            renderExperienceTable();
        }
    };

    document.getElementById("btn-add-exp-modal").addEventListener("click", async () => {
        const company = prompt("Enter Company:");
        const title = prompt("Enter Title:");
        const duration = prompt("Enter Duration (e.g. Jan 2022 - May 2023):");
        const desc = prompt("Enter Short Description:");
        if (company && title) {
            const { error } = await supabase.from("experience").insert({
                company: company,
                title: title,
                duration: duration,
                description: desc
            });
            if (error) {
                alert("Error adding experience: " + error.message);
                return;
            }
            renderExperienceTable();
        }
    });

    // Education CRUD
    async function renderEducationTable() {
        const { data: edu, error } = await supabase
            .from("education")
            .select("*")
            .order("created_at", { ascending: true });
        if (error) {
            alert("Error loading education: " + error.message);
            return;
        }
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
    }

    window.deleteEducationRow = async function(id) {
        if (confirm("Are you sure?")) {
            const { error } = await supabase.from("education").delete().eq("id", id);
            if (error) {
                alert("Error deleting education: " + error.message);
                return;
            }
            renderEducationTable();
        }
    };

    document.getElementById("btn-add-edu-modal").addEventListener("click", async () => {
        const school = prompt("Enter School/Institution:");
        const degree = prompt("Enter Degree:");
        const duration = prompt("Enter Duration:");
        const details = prompt("Enter Grades/Details:");
        if (school && degree) {
            const { error } = await supabase.from("education").insert({
                school: school,
                degree: degree,
                duration: duration,
                details: details
            });
            if (error) {
                alert("Error adding education: " + error.message);
                return;
            }
            renderEducationTable();
        }
    });

    // Certificates CRUD
    async function renderCertificatesTable() {
        const { data: certs, error } = await supabase
            .from("certificates")
            .select("*")
            .order("created_at", { ascending: true });
        if (error) {
            alert("Error loading certificates: " + error.message);
            return;
        }
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
    }

    window.deleteCertificateRow = async function(id) {
        if (confirm("Are you sure?")) {
            const { error } = await supabase.from("certificates").delete().eq("id", id);
            if (error) {
                alert("Error deleting certificate: " + error.message);
                return;
            }
            renderCertificatesTable();
        }
    };

    document.getElementById("btn-add-cert-modal").addEventListener("click", async () => {
        const title = prompt("Enter Certificate Title:");
        const issuer = prompt("Enter Issuer:");
        const date = prompt("Enter Date:");
        const credId = prompt("Enter Credential ID:");
        if (title && issuer) {
            const { error } = await supabase.from("certificates").insert({
                title: title,
                issuer: issuer,
                date: date,
                credential_id: credId
            });
            if (error) {
                alert("Error adding certificate: " + error.message);
                return;
            }
            renderCertificatesTable();
        }
    });

    // Blog CRUD
    async function renderBlogTable() {
        const { data: blogs, error } = await supabase
            .from("blogs")
            .select("*")
            .order("created_at", { ascending: true });
        if (error) {
            alert("Error loading blog posts: " + error.message);
            return;
        }
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
    }

    window.deleteBlogRow = async function(id) {
        if (confirm("Are you sure?")) {
            const { error } = await supabase.from("blogs").delete().eq("id", id);
            if (error) {
                alert("Error deleting blog post: " + error.message);
                return;
            }
            renderBlogTable();
        }
    };

    document.getElementById("btn-add-blog-modal").addEventListener("click", async () => {
        const title = prompt("Enter Article Title:");
        if (title) {
            const { error } = await supabase.from("blogs").insert({
                title: title,
                status: "Published",
                date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                views: 0
            });
            if (error) {
                alert("Error adding blog post: " + error.message);
                return;
            }
            renderBlogTable();
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

    // Settings Credentials Form (uses Supabase Auth directly, since these
    // are the actual admin login credentials rather than app data)
    async function populateSettingsForm() {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) {
            alert("Error loading account info: " + error.message);
            return;
        }
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

            const user = document.getElementById("set-username").value;
            const pass = document.getElementById("set-password").value;

            const updatePayload = { email: user };
            if (pass) updatePayload.password = pass;

            const { error } = await supabase.auth.updateUser(updatePayload);

            setButtonLoading(submitBtn, false);

            if (error) {
                alert("Error updating credentials: " + error.message);
                return;
            }

            alert("System settings saved! Admin login credentials updated.");
        });
    }

    // Initialize SPA state on authentication
    function initializeDashboard() {
        switchView("dashboard");
        initializeCharts();
    }

    // Kickoff gate verification
    checkAuth();
});