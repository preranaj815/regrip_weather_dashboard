/* ============================================================
   Portfolio — interactions, content rendering & admin editing.
   Vanilla JS. Single source of truth = content.json.

   Loading priority:
     1. localStorage draft (your unsaved admin edits)
     2. fetched content.json (published, used on http/Netlify)
     3. embedded #seedContent (fallback when opened as a file://)

   Admin editing is client-side only. The password below just hides
   the edit UI from casual visitors — it is NOT real security. Real
   auth comes later via Netlify Identity + Decap CMS.
   ============================================================ */
(function () {
    "use strict";

    /* EDIT: change this admin password. (Client-side only — not secure.) */
    var ADMIN_PASSWORD = "changeme";

    var STORAGE_KEY = "portfolioContent";
    var SESSION_ADMIN = "portfolioAdmin";
    var content = null;
    var editing = false;
    var revealObserver = null;

    /* ---------------- Path helpers ---------------- */
    function getPath(obj, path) {
        return path.split(".").reduce(function (o, k) {
            return o == null ? undefined : o[k];
        }, obj);
    }
    function setPath(obj, path, val) {
        var keys = path.split(".");
        var last = keys.pop();
        var target = keys.reduce(function (o, k) { return o[k]; }, obj);
        if (target) target[last] = val;
    }
    function defaultFor(path) {
        var leaf = path.split(".").pop();
        if (leaf === "paragraphs") return "New paragraph.";
        if (leaf === "facts") return { label: "Label", value: "Value" };
        if (leaf === "skills") return { group: "New group", items: ["Skill"] };
        if (leaf === "items" || leaf === "tech") return "New";
        if (leaf === "projects") return { title: "New project", desc: "What it does, the stack, and the outcome.", tech: ["Tech"], links: [{ label: "Source", url: "#" }] };
        if (leaf === "links" || leaf === "socials") return { label: "Link", url: "#" };
        return "";
    }

    /* ---------------- Small DOM helpers ---------------- */
    function el(tag, cls, text) {
        var n = document.createElement(tag);
        if (cls) n.className = cls;
        if (text != null) n.textContent = text;
        return n;
    }
    function editableText(tag, cls, path, value) {
        var n = el(tag, cls, value);
        n.setAttribute("data-edit", path);
        return n;
    }
    function removeCtrl(path, index) {
        var b = el("button", "admin-ctrl admin-ctrl--rm", "×");
        b.type = "button";
        b.title = "Remove";
        b.setAttribute("data-remove", path);
        b.setAttribute("data-index", index);
        return b;
    }
    function addCtrl(path, label) {
        var b = el("button", "admin-ctrl admin-ctrl--add", label || "+ Add");
        b.type = "button";
        b.setAttribute("data-add", path);
        return b;
    }
    function urlInput(path, value) {
        var i = document.createElement("input");
        i.type = "url";
        i.className = "url-edit admin-ctrl";
        i.value = value || "";
        i.placeholder = "https://…";
        i.setAttribute("data-url", path);
        return i;
    }

    /* ---------------- Rendering ---------------- */
    function renderScalars() {
        document.querySelectorAll("[data-edit]").forEach(function (node) {
            node.textContent = getPath(content, node.getAttribute("data-edit")) || "";
        });
        document.querySelectorAll("[data-edit-html]").forEach(function (node) {
            node.innerHTML = getPath(content, node.getAttribute("data-edit-html")) || "";
        });
        var meta = document.querySelector('meta[data-edit-attr="meta.description"]');
        if (meta) meta.setAttribute("content", (content.meta && content.meta.description) || "");
        var emailBtn = document.getElementById("emailBtn");
        if (emailBtn && content.contact) emailBtn.href = "mailto:" + content.contact.email;
        if (content.meta && content.meta.title) document.title = content.meta.title;
    }

    function renderTagList(container, basePath, items) {
        container.innerHTML = "";
        (items || []).forEach(function (item, i) {
            var li = el("li");
            li.appendChild(editableText("span", null, basePath + "." + i, item));
            li.appendChild(removeCtrl(basePath, i));
            container.appendChild(li);
        });
        container.appendChild(addCtrl(basePath, "+"));
    }

    function renderLinks(container, basePath, links) {
        container.innerHTML = "";
        (links || []).forEach(function (lnk, i) {
            var wrap = el("span", "link-edit");
            var a = editableText("a", "link", basePath + "." + i + ".label", lnk.label);
            a.href = lnk.url || "#";
            if (/^https?:\/\//i.test(lnk.url || "")) {
                a.target = "_blank";
                a.rel = "noopener noreferrer";
            }
            wrap.appendChild(a);
            wrap.appendChild(urlInput(basePath + "." + i + ".url", lnk.url));
            wrap.appendChild(removeCtrl(basePath, i));
            container.appendChild(wrap);
        });
        container.appendChild(addCtrl(basePath, "+ link"));
    }

    function renderList(container) {
        var key = container.getAttribute("data-list");

        if (key === "about.paragraphs") {
            container.innerHTML = "";
            content.about.paragraphs.forEach(function (p, i) {
                var para = el("p");
                para.appendChild(editableText("span", null, "about.paragraphs." + i, p));
                para.appendChild(removeCtrl("about.paragraphs", i));
                container.appendChild(para);
            });
            container.appendChild(addCtrl("about.paragraphs", "+ paragraph"));

        } else if (key === "about.facts") {
            container.innerHTML = "";
            content.about.facts.forEach(function (f, i) {
                var row = el("div");
                row.appendChild(editableText("dt", null, "about.facts." + i + ".label", f.label));
                row.appendChild(editableText("dd", null, "about.facts." + i + ".value", f.value));
                row.appendChild(removeCtrl("about.facts", i));
                container.appendChild(row);
            });
            container.appendChild(addCtrl("about.facts", "+ fact"));

        } else if (key === "skills") {
            container.innerHTML = "";
            content.skills.forEach(function (group, i) {
                var card = el("div", "skills__group reveal");
                var head = el("div", "skills__head");
                head.appendChild(editableText("h3", null, "skills." + i + ".group", group.group));
                head.appendChild(removeCtrl("skills", i));
                card.appendChild(head);
                var ul = el("ul", "tags");
                renderTagList(ul, "skills." + i + ".items", group.items);
                card.appendChild(ul);
                container.appendChild(card);
            });
            container.appendChild(addCtrl("skills", "+ group"));

        } else if (key === "featured.tech") {
            renderTagList(container, "featured.tech", content.featured.tech);

        } else if (key === "featured.links") {
            renderLinks(container, "featured.links", content.featured.links);

        } else if (key === "projects") {
            container.innerHTML = "";
            content.projects.forEach(function (proj, i) {
                var card = el("article", "project-card reveal");
                card.appendChild(removeCtrl("projects", i));
                card.appendChild(editableText("h3", "project-card__title", "projects." + i + ".title", proj.title));
                card.appendChild(editableText("p", "project-card__desc", "projects." + i + ".desc", proj.desc));
                var ul = el("ul", "tags tags--sm");
                renderTagList(ul, "projects." + i + ".tech", proj.tech);
                card.appendChild(ul);
                var links = el("div", "project__links");
                renderLinks(links, "projects." + i + ".links", proj.links);
                card.appendChild(links);
                container.appendChild(card);
            });
            container.appendChild(addCtrl("projects", "+ project"));

        } else if (key === "socials") {
            renderLinks(container, "socials", content.socials);
        }
    }

    function renderAll() {
        renderScalars();
        document.querySelectorAll("[data-list]").forEach(renderList);
        if (editing) applyEditable(true);
        observeReveals();
    }

    /* ---------------- Reveal-on-scroll ---------------- */
    function observeReveals() {
        var els = document.querySelectorAll(".reveal:not(.is-visible)");
        if (!("IntersectionObserver" in window)) {
            els.forEach(function (e) { e.classList.add("is-visible"); });
            return;
        }
        if (!revealObserver) {
            revealObserver = new IntersectionObserver(function (entries) {
                entries.forEach(function (entry) {
                    if (entry.isIntersecting) {
                        entry.target.classList.add("is-visible");
                        revealObserver.unobserve(entry.target);
                    }
                });
            }, { threshold: 0.12 });
        }
        els.forEach(function (e) {
            if (editing) { e.classList.add("is-visible"); }
            else { revealObserver.observe(e); }
        });
    }

    /* ---------------- Editing ---------------- */
    function applyEditable(on) {
        document.querySelectorAll("[data-edit], [data-edit-html]").forEach(function (node) {
            node.contentEditable = on ? "true" : "false";
            node.classList.toggle("is-editable", on);
        });
    }

    var saveTimer;
    function persistSoon() {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(function () {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(content));
        }, 350);
    }

    document.addEventListener("input", function (e) {
        var t = e.target;
        if (t.isContentEditable && t.getAttribute("data-edit")) {
            setPath(content, t.getAttribute("data-edit"), t.textContent);
            persistSoon();
        } else if (t.isContentEditable && t.getAttribute("data-edit-html")) {
            setPath(content, t.getAttribute("data-edit-html"), t.innerHTML);
            persistSoon();
        } else if (t.matches && t.matches("input[data-url]")) {
            setPath(content, t.getAttribute("data-url"), t.value);
            persistSoon();
        }
    });

    document.addEventListener("click", function (e) {
        var add = e.target.closest && e.target.closest("[data-add]");
        var rm = e.target.closest && e.target.closest("[data-remove]");
        if (add) {
            e.preventDefault();
            var p = add.getAttribute("data-add");
            var arr = getPath(content, p);
            if (Array.isArray(arr)) arr.push(defaultFor(p));
            persistSoon();
            renderAll();
        } else if (rm) {
            e.preventDefault();
            var path = rm.getAttribute("data-remove");
            var idx = parseInt(rm.getAttribute("data-index"), 10);
            var list = getPath(content, path);
            if (Array.isArray(list)) list.splice(idx, 1);
            persistSoon();
            renderAll();
        }
    });

    /* Keep contenteditable as plain text (strip pasted formatting) */
    document.addEventListener("paste", function (e) {
        var t = e.target;
        if (t.isContentEditable && t.getAttribute("data-edit")) {
            e.preventDefault();
            var text = (e.clipboardData || window.clipboardData).getData("text");
            document.execCommand("insertText", false, text);
        }
    });

    function setEditing(on) {
        editing = on;
        document.body.classList.toggle("is-editing", on);
        applyEditable(on);
        observeReveals();
        var hint = document.getElementById("adminHint");
        var editBtn = document.getElementById("editBtn");
        if (hint) hint.textContent = on ? "Editing — changes auto-save locally" : "Viewing";
        if (editBtn) editBtn.textContent = on ? "Done editing" : "Edit";
    }

    /* ---------------- Export ---------------- */
    function exportContent() {
        var blob = new Blob([JSON.stringify(content, null, 2)], { type: "application/json" });
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = "content.json";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /* ---------------- Admin session ---------------- */
    function showAdmin() {
        sessionStorage.setItem(SESSION_ADMIN, "1");
        var bar = document.getElementById("adminBar");
        if (bar) bar.hidden = false;
    }
    function hideAdmin() {
        sessionStorage.removeItem(SESSION_ADMIN);
        setEditing(false);
        var bar = document.getElementById("adminBar");
        if (bar) bar.hidden = true;
    }
    function promptLogin() {
        if (sessionStorage.getItem(SESSION_ADMIN) === "1") { showAdmin(); return; }
        var pw = window.prompt("Admin password:");
        if (pw == null) return;
        if (pw === ADMIN_PASSWORD) showAdmin();
        else window.alert("Incorrect password.");
    }

    /* ---------------- Theme ---------------- */
    function initTheme() {
        var root = document.documentElement;
        var saved = localStorage.getItem("theme");
        var prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
        root.setAttribute("data-theme", saved || (prefersDark ? "dark" : "light"));
        var toggle = document.getElementById("themeToggle");
        if (toggle) toggle.addEventListener("click", function () {
            var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
            root.setAttribute("data-theme", next);
            localStorage.setItem("theme", next);
        });
    }

    /* ---------------- Nav ---------------- */
    function initNav() {
        var nav = document.getElementById("nav");
        var onScroll = function () { if (nav) nav.classList.toggle("is-scrolled", window.scrollY > 8); };
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });

        var menuToggle = document.getElementById("menuToggle");
        var navLinks = document.getElementById("navLinks");
        if (menuToggle && navLinks) {
            menuToggle.addEventListener("click", function () {
                var open = navLinks.classList.toggle("is-open");
                menuToggle.setAttribute("aria-expanded", String(open));
            });
            navLinks.addEventListener("click", function (e) {
                if (e.target.tagName === "A") {
                    navLinks.classList.remove("is-open");
                    menuToggle.setAttribute("aria-expanded", "false");
                }
            });
        }
    }

    /* ---------------- Admin controls wiring ---------------- */
    function initAdmin() {
        var editBtn = document.getElementById("editBtn");
        var exportBtn = document.getElementById("exportBtn");
        var resetBtn = document.getElementById("resetBtn");
        var logoutBtn = document.getElementById("logoutBtn");
        if (editBtn) editBtn.addEventListener("click", function () { setEditing(!editing); });
        if (exportBtn) exportBtn.addEventListener("click", exportContent);
        if (resetBtn) resetBtn.addEventListener("click", function () {
            if (window.confirm("Discard local edits and reload published content?")) {
                localStorage.removeItem(STORAGE_KEY);
                location.reload();
            }
        });
        if (logoutBtn) logoutBtn.addEventListener("click", hideAdmin);

        // Login triggers: #admin in URL, or Ctrl/Cmd+Shift+E
        if (location.hash === "#admin") promptLogin();
        if (sessionStorage.getItem(SESSION_ADMIN) === "1") showAdmin();
        document.addEventListener("keydown", function (e) {
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "E" || e.key === "e")) {
                e.preventDefault();
                promptLogin();
            }
        });
    }

    /* ---------------- Content loading ---------------- */
    function readSeed() {
        try {
            return JSON.parse(document.getElementById("seedContent").textContent);
        } catch (err) {
            console.error("Seed content parse failed:", err);
            return {};
        }
    }

    function boot() {
        initTheme();

        var draft = localStorage.getItem(STORAGE_KEY);
        if (draft) {
            // Admin has an unsaved local draft — that wins.
            try { content = JSON.parse(draft); } catch (e) { content = readSeed(); }
            renderAll();
        } else {
            // Paint the seed immediately, then refine from content.json if reachable.
            content = readSeed();
            renderAll();
            if (location.protocol !== "file:") {
                fetch("content.json", { cache: "no-store" })
                    .then(function (r) { return r.ok ? r.json() : null; })
                    .then(function (data) {
                        if (data && !localStorage.getItem(STORAGE_KEY)) {
                            content = data;
                            renderAll();
                        }
                    })
                    .catch(function () { /* keep seed */ });
            }
        }

        initNav();
        initAdmin();

        var yearEl = document.getElementById("year");
        if (yearEl) yearEl.textContent = new Date().getFullYear();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot);
    } else {
        boot();
    }
})();
