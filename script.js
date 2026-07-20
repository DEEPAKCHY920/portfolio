document.addEventListener("DOMContentLoaded", () => {
    // 1. Initialize Lucide Icons
    lucide.createIcons();

    // 2. Mobile Menu Toggle
    const mobileMenuToggle = document.getElementById("mobile-menu-toggle");
    const navMenu = document.getElementById("nav-menu");
    const menuIcon = document.getElementById("menu-icon");

    if (mobileMenuToggle && navMenu) {
        mobileMenuToggle.addEventListener("click", () => {
            navMenu.classList.toggle("open");
            const isOpen = navMenu.classList.contains("open");
            
            // Toggle icon between 'menu' and 'x'
            if (isOpen) {
                menuIcon.setAttribute("data-lucide", "x");
            } else {
                menuIcon.setAttribute("data-lucide", "menu");
            }
            lucide.createIcons();
        });

        // Close menu when clicking a nav link
        const navLinks = document.querySelectorAll(".nav-link");
        navLinks.forEach(link => {
            link.addEventListener("click", () => {
                navMenu.classList.remove("open");
                menuIcon.setAttribute("data-lucide", "menu");
                lucide.createIcons();
            });
        });
    }

    // 3. Header Scroll Effect
    const header = document.querySelector(".header");
    window.addEventListener("scroll", () => {
        if (window.scrollY > 50) {
            header.classList.add("scrolled");
        } else {
            header.classList.remove("scrolled");
        }
    });

    // 4. Scroll Reveal Animation using Intersection Observer
    const revealElements = document.querySelectorAll(".reveal");
    const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add("active");
                // Option: Unobserve if you only want the animation to run once
                // observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.15,
        rootMargin: "0px 0px -50px 0px"
    });

    revealElements.forEach(element => {
        revealObserver.observe(element);
    });

    // 5. Active Section Navigation Link Highlight on Scroll
    const sections = document.querySelectorAll("section");
    const navLinks = document.querySelectorAll(".nav-link");

    window.addEventListener("scroll", () => {
        let currentSectionId = "";
        
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.clientHeight;
            
            // Adjust threshold to feel natural
            if (window.scrollY >= sectionTop - 180) {
                currentSectionId = section.getAttribute("id");
            }
        });

        navLinks.forEach(link => {
            link.classList.remove("active");
            if (link.getAttribute("href") === `#${currentSectionId}`) {
                link.classList.add("active");
            }
        });
    });

    // 6. Interactive Play Button (About Me workspace showcase)
    const btnPlayShowcase = document.getElementById("btn-play-showcase");
    if (btnPlayShowcase) {
        btnPlayShowcase.addEventListener("click", () => {
            alert("This is a demo showcase video. In a production build, this would launch a popup/modal player showing Deepak's workspace vlog or portfolio walkthrough!");
        });
    }

    // 7. Contact Form Simulation and LocalStorage saving
    const contactForm = document.getElementById("contact-form");
    if (contactForm) {
        contactForm.addEventListener("submit", (e) => {
            e.preventDefault();
            
            const name = document.getElementById("form-name").value;
            const email = document.getElementById("form-email").value;
            const subject = document.getElementById("form-subject").value;
            const message = document.getElementById("form-message").value;

            // Simple user feedback
            const submitBtn = document.getElementById("btn-submit-message");
            const originalContent = submitBtn.innerHTML;

            submitBtn.disabled = true;
            submitBtn.innerHTML = `<span>Sending...</span><i data-lucide="loader" class="icon-sm spin"></i>`;
            lucide.createIcons();

            // Save to localStorage so admin panel can read it
            const messages = JSON.parse(localStorage.getItem("portfolio_messages") || "[]");
            messages.push({
                id: Date.now().toString(),
                name: name,
                email: email,
                subject: subject,
                message: message,
                date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' ' + new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                read: false
            });
            localStorage.setItem("portfolio_messages", JSON.stringify(messages));
            // Trigger storage event so other tabs refresh
            window.dispatchEvent(new Event('storage'));

            setTimeout(() => {
                submitBtn.style.backgroundColor = "#22c55e"; // green success
                submitBtn.innerHTML = `<span>Sent Successfully!</span><i data-lucide="check" class="icon-sm"></i>`;
                lucide.createIcons();

                setTimeout(() => {
                    submitBtn.disabled = false;
                    submitBtn.style.backgroundColor = "";
                    submitBtn.innerHTML = originalContent;
                    lucide.createIcons();
                    contactForm.reset();
                }, 3000);
            }, 1500);
        });
    }

    // 8. Dynamic Content Loader (integrating with Admin Panel)
    function loadDynamicContent() {
        // Load Projects
        const storedProjects = localStorage.getItem("portfolio_projects");
        if (storedProjects) {
            const projects = JSON.parse(storedProjects);
            const container = document.getElementById("projects-container");
            if (container) {
                // Filter only published projects
                const publishedProjects = projects.filter(p => p.status === 'Published');
                if (publishedProjects.length > 0) {
                    container.innerHTML = "";
                    publishedProjects.forEach((proj, idx) => {
                        const projectNum = (idx + 1).toString().padStart(2, '0');
                        const tagsHTML = proj.tags.map(t => `<span class="tag">${t}</span>`).join('');
                        container.innerHTML += `
                            <div class="project-card reveal active">
                                <div class="project-image-box">
                                    <img src="${proj.image}" alt="${proj.title} mockup" class="project-img">
                                    <span class="project-number">${projectNum}</span>
                                </div>
                                <div class="project-info">
                                    <h3 class="project-title">${proj.title}</h3>
                                    <p class="project-desc">${proj.description}</p>
                                    <div class="project-tags">
                                        ${tagsHTML}
                                    </div>
                                    <a href="${proj.link || '#'}" class="project-link" aria-label="Visit ${proj.title} website">
                                        <i data-lucide="external-link"></i>
                                    </a>
                                </div>
                            </div>
                        `;
                    });
                }
            }
        }

        // Load Skills
        const storedSkills = localStorage.getItem("portfolio_skills");
        if (storedSkills) {
            const skills = JSON.parse(storedSkills);
            const container = document.getElementById("skills-container");
            if (container) {
                if (skills.length > 0) {
                    container.innerHTML = "";
                    skills.forEach(skill => {
                        container.innerHTML += `
                            <div class="skill-card reveal active">
                                <div class="skill-card-icon">
                                    <i data-lucide="${skill.icon || 'code-2'}" class="text-cyan"></i>
                                </div>
                                <h3 class="skill-card-title">${skill.title}</h3>
                                <p class="skill-card-desc">${skill.description}</p>
                                <div class="skill-card-hover-border"></div>
                            </div>
                        `;
                    });
                }
            }
        }

        // Load Achievements
        const storedAchievements = localStorage.getItem("portfolio_achievements");
        if (storedAchievements) {
            const achievements = JSON.parse(storedAchievements);
            const container = document.getElementById("achievements-container");
            if (container) {
                if (achievements.length > 0) {
                    container.innerHTML = "";
                    achievements.forEach(ach => {
                        container.innerHTML += `
                            <div class="achievement-card reveal active">
                                <div class="achievement-icon-box">
                                    <i data-lucide="${ach.icon || 'award'}" class="text-cyan"></i>
                                </div>
                                <div class="achievement-content">
                                    <span class="achievement-date">${ach.date}</span>
                                    <h3 class="achievement-title">${ach.title}</h3>
                                    <p class="achievement-desc">${ach.description}</p>
                                </div>
                            </div>
                        `;
                    });
                }
            }
        }

        // Load Testimonials
        const storedTestimonials = localStorage.getItem("portfolio_testimonials");
        if (storedTestimonials) {
            const testimonials = JSON.parse(storedTestimonials);
            const container = document.getElementById("testimonials-container");
            if (container) {
                if (testimonials.length > 0) {
                    container.innerHTML = "";
                    testimonials.forEach(test => {
                        container.innerHTML += `
                            <div class="testimonial-card reveal active">
                                <div class="testimonial-quote">
                                    <i data-lucide="quote" class="text-cyan"></i>
                                </div>
                                <p class="testimonial-text">"${test.text}"</p>
                                <div class="testimonial-author">
                                    <div class="author-avatar-box">
                                        <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" class="text-cyan"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                    </div>
                                    <div class="author-info">
                                        <h4 class="author-name">${test.author}</h4>
                                        <span class="author-title">${test.title}</span>
                                    </div>
                                </div>
                            </div>
                        `;
                    });
                }
            }
        }

        // Load Profile Details
        const storedProfile = localStorage.getItem("portfolio_profile");
        if (storedProfile) {
            const profile = JSON.parse(storedProfile);
            // Hero Title and Subtitle
            const heroTitle = document.querySelector(".hero-title");
            if (heroTitle && profile.name) {
                heroTitle.innerHTML = `Hi, I'm <br><span class="gradient-text">${profile.name}</span>`;
            }
            const heroSubtitle = document.querySelector(".hero-subtitle");
            if (heroSubtitle && profile.title) {
                heroSubtitle.textContent = profile.title;
            }
            const heroDescription = document.querySelector(".hero-description");
            if (heroDescription && profile.bio) {
                heroDescription.textContent = profile.bio;
            }
            const profileImg = document.querySelector(".profile-img");
            if (profileImg && profile.avatar) {
                profileImg.src = profile.avatar;
            }

            // About Me
            const aboutBio = document.querySelector(".about-bio");
            if (aboutBio && profile.about_bio) {
                aboutBio.textContent = profile.about_bio;
            }

            // Update cards in About Section
            const aboutCards = document.querySelectorAll(".info-card");
            aboutCards.forEach(card => {
                const label = card.querySelector(".info-label").textContent.trim();
                const valueEl = card.querySelector(".info-value");
                if (label === "Education" && profile.education) {
                    valueEl.textContent = profile.education;
                } else if (label === "Specialization" && profile.specialization) {
                    valueEl.textContent = profile.specialization;
                } else if (label === "Location" && profile.location) {
                    valueEl.textContent = profile.location;
                } else if (label === "Email" && profile.email) {
                    valueEl.textContent = profile.email;
                }
            });

            // Update stats counters
            const pStat = document.getElementById("stat-projects");
            if (pStat && profile.stat_projects) pStat.textContent = profile.stat_projects;
            
            const eStat = document.getElementById("stat-experience");
            if (eStat && profile.stat_experience) eStat.textContent = profile.stat_experience;
            
            const prStat = document.getElementById("stat-problems");
            if (prStat && profile.stat_problems) prStat.textContent = profile.stat_problems;
            
            const cStat = document.getElementById("stat-commits");
            if (cStat && profile.stat_commits) cStat.textContent = profile.stat_commits;
        }
        
        lucide.createIcons();
    }

    loadDynamicContent();
    window.addEventListener("storage", loadDynamicContent);
});
