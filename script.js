(() => {
    "use strict";

    const STORAGE_KEYS = {
        start: "site-namorada.gravidezInicio",
        due: "site-namorada.partoPrevisto"
    };

    function plural(value, singular, pluralForm) {
        return value === 1 ? singular : pluralForm;
    }

    function safeStorageGet(key) {
        try {
            return localStorage.getItem(key);
        } catch {
            return null;
        }
    }

    function safeStorageSet(key, value) {
        try {
            localStorage.setItem(key, value);
        } catch {
            // Ignora falhas (modo privado/restricoes).
        }
    }

    function safeStorageRemove(key) {
        try {
            localStorage.removeItem(key);
        } catch {
            // Ignora falhas (modo privado/restricoes).
        }
    }

    function parseISODate(value) {
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || "").trim());
        if (!match) return null;

        const year = Number(match[1]);
        const monthIndex = Number(match[2]) - 1;
        const day = Number(match[3]);
        const date = new Date(year, monthIndex, day);
        return Number.isNaN(date.getTime()) ? null : date;
    }

    function toLocalNoon(date) {
        return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
    }

    function addDays(date, days) {
        const next = new Date(date.getTime());
        next.setDate(next.getDate() + days);
        return next;
    }

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function formatISODate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    }

    const brDateFormatter = new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
    });

    function formatBRDate(date) {
        return brDateFormatter.format(date);
    }

    function setTextById(id, text) {
        const node = document.getElementById(id);
        if (!node) return;
        node.textContent = text;
    }

    function supportsWebP() {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(img.width === 1);
            img.onerror = () => resolve(false);
            img.src = "data:image/webp;base64,UklGRiIAAABXRUJQVlA4TCEAAAAvAAAAAAfQ//73v/+BiOh/AAA=";
        });
    }

    function setCurrentNavLink() {
        const links = document.querySelectorAll(".nav a[href]");
        if (!links.length) return;

        const file = (location.pathname || "").split("/").pop() || "index.html";

        links.forEach((link) => {
            const href = (link.getAttribute("href") || "").split("/").pop();
            if (!href) return;

            if (href === file) link.setAttribute("aria-current", "page");
            else link.removeAttribute("aria-current");
        });
    }

    function updateGravidez() {
        const el = document.getElementById("gravidez");
        if (!el) return;

        const defaultStartStr = el.getAttribute("data-gravidez-inicio") || "2026-01-01";
        const storedStartStr = safeStorageGet(STORAGE_KEYS.start);
        const startStr = storedStartStr || defaultStartStr;
        const startDate = parseISODate(startStr);

        if (!startDate) {
            el.textContent = "Configure a data inicial no formato AAAA-MM-DD.";
            setTextById("gravidezSub", "Edite a data no HTML ou use 'Configurar datas'.");
            return;
        }

        const today = new Date();
        const todayDays = toLocalNoon(today);
        const startDays = toLocalNoon(startDate);

        const rawDiffDays = Math.floor((todayDays - startDays) / 86400000);
        const elapsedDays = Math.max(0, rawDiffDays);
        const weeks = Math.floor(elapsedDays / 7);
        const days = elapsedDays % 7;

        const weeksLabel = plural(weeks, "semana", "semanas");
        const daysLabel = plural(days, "dia", "dias");
        const trimester = weeks < 14 ? "1º trimestre" : weeks < 28 ? "2º trimestre" : "3º trimestre";

        el.textContent = `Nosso bebê está com ${weeks} ${weeksLabel} e ${days} ${daysLabel}.`;

        const defaultDueStr = el.getAttribute("data-parto-previsto") || "";
        const storedDueStr = safeStorageGet(STORAGE_KEYS.due);
        const dueFromInput = storedDueStr || defaultDueStr;

        let dueDate = parseISODate(dueFromInput);
        if (!dueDate) dueDate = addDays(startDate, 280);

        if (dueDate.getTime() < startDate.getTime()) dueDate = addDays(startDate, 280);

        const dueDays = toLocalNoon(dueDate);
        const totalDays = Math.max(1, Math.floor((dueDays - startDays) / 86400000));
        const remainingDays = totalDays - elapsedDays;

        const remainingAbsDays = Math.abs(remainingDays);
        const remainingAbsWeeks = Math.floor(remainingAbsDays / 7);
        const remainingAbsExtraDays = remainingAbsDays % 7;

        const remainingWeeksLabel = plural(remainingAbsWeeks, "semana", "semanas");
        const remainingDaysLabel = plural(remainingAbsExtraDays, "dia", "dias");

        const percent = clamp((elapsedDays / totalDays) * 100, 0, 100);

        const progressBar = document.getElementById("gravidezProgressoBar");
        if (progressBar) progressBar.style.width = `${percent.toFixed(0)}%`;

        const progress = document.getElementById("gravidezProgresso");
        if (progress) progress.setAttribute("aria-valuenow", String(percent.toFixed(0)));

        setTextById("gravidezHoje", formatBRDate(todayDays));
        setTextById("gravidezInicio", formatBRDate(startDays));
        setTextById("gravidezTrimestre", trimester);
        setTextById("gravidezParto", formatBRDate(dueDays));

        if (remainingDays > 0) {
            const label = plural(remainingDays, "dia", "dias");
            setTextById("gravidezFaltam", `${remainingDays} ${label}`);
            setTextById(
                "gravidezSub",
                `Faltam ${remainingAbsWeeks} ${remainingWeeksLabel} e ${remainingAbsExtraDays} ${remainingDaysLabel} para a data prevista.`
            );
        } else if (remainingDays === 0) {
            setTextById("gravidezFaltam", "Hoje");
            setTextById("gravidezSub", "Chegou a data prevista.");
        } else {
            const label = plural(remainingAbsDays, "dia", "dias");
            setTextById("gravidezFaltam", `+${remainingAbsDays} ${label}`);
            setTextById(
                "gravidezSub",
                `Passaram ${remainingAbsWeeks} ${remainingWeeksLabel} e ${remainingAbsExtraDays} ${remainingDaysLabel} da data prevista.`
            );
        }

        if (rawDiffDays < 0) {
            const untilDays = Math.abs(rawDiffDays);
            const untilLabel = plural(untilDays, "dia", "dias");
            el.textContent = `Faltam ${untilDays} ${untilLabel} para o início.`;
            setTextById("gravidezFaltam", `${totalDays} ${plural(totalDays, "dia", "dias")}`);
            setTextById("gravidezSub", `Início: ${formatBRDate(startDays)}. Estimativa baseada em 40 semanas.`);
        }

        const progressText = remainingDays >= 0 ? "Progresso" : "Progresso (estimado)";
        setTextById(
            "gravidezProgressoTexto",
            `${progressText}: ${percent.toFixed(0)}% (${Math.min(elapsedDays, totalDays)} de ${totalDays} dias).`
        );
    }

    function setupGravidezConfig() {
        const gravidezEl = document.getElementById("gravidez");
        if (!gravidezEl) return;

        const startInput = document.getElementById("inicioInput");
        const dueInput = document.getElementById("partoInput");
        const resetBtn = document.getElementById("configReset");

        if (!startInput && !dueInput && !resetBtn) return;

        const defaultStartStr = gravidezEl.getAttribute("data-gravidez-inicio") || "2026-01-01";
        const defaultDueStr = gravidezEl.getAttribute("data-parto-previsto") || "";

        const refreshInputs = () => {
            const startStr = safeStorageGet(STORAGE_KEYS.start) || defaultStartStr;
            const startDate = parseISODate(startStr);
            if (startInput && startDate) startInput.value = formatISODate(startDate);

            const dueStr = safeStorageGet(STORAGE_KEYS.due) || defaultDueStr;
            const dueDate = parseISODate(dueStr);
            if (dueInput) dueInput.value = dueDate ? formatISODate(dueDate) : "";
        };

        refreshInputs();

        if (startInput) {
            startInput.addEventListener("change", () => {
                const next = parseISODate(startInput.value);
                if (next) safeStorageSet(STORAGE_KEYS.start, formatISODate(next));
                else safeStorageRemove(STORAGE_KEYS.start);

                updateGravidez();
                refreshInputs();
            });
        }

        if (dueInput) {
            dueInput.addEventListener("change", () => {
                const next = parseISODate(dueInput.value);
                if (next) safeStorageSet(STORAGE_KEYS.due, formatISODate(next));
                else safeStorageRemove(STORAGE_KEYS.due);

                updateGravidez();
                refreshInputs();
            });
        }

        if (resetBtn) {
            resetBtn.addEventListener("click", () => {
                safeStorageRemove(STORAGE_KEYS.start);
                safeStorageRemove(STORAGE_KEYS.due);
                updateGravidez();
                refreshInputs();
            });
        }
    }

    function setupBrokenImages() {
        const images = document.querySelectorAll(".photo img");
        if (!images.length) return;

        const notice = document.getElementById("albumNotice");
        const showNotice = () => {
            if (!notice) return;
            notice.hidden = false;
        };

        let brokenCount = 0;
        const hasWebp = Array.from(images).some((img) =>
            String(img.getAttribute("src") || "").toLowerCase().endsWith(".webp")
        );

        images.forEach((img) => {
            const applyFallback = () => {
                const figure = img.closest(".photo");
                if (!figure) {
                    img.style.display = "none";
                    return;
                }

                figure.classList.add("is-broken");
                const caption = figure.querySelector("figcaption");

                if (caption && !caption.dataset.fallbackApplied) {
                    const src = img.getAttribute("src") || "";
                    caption.textContent = src
                        ? `${caption.textContent} (não consegui carregar: ${src})`
                        : caption.textContent;
                    caption.dataset.fallbackApplied = "1";
                }
            };

            img.addEventListener(
                "error",
                () => {
                    brokenCount += 1;
                    applyFallback();
                    showNotice();
                },
                { once: true }
            );
        });

        if (notice && hasWebp) {
            supportsWebP().then((supported) => {
                if (!supported) showNotice();
            });
        }
    }

    function setupChapters() {
        const container = document.querySelector(".chapters");
        if (!container) return;

        const chapters = Array.from(container.querySelectorAll("details.chapter[id]"));
        if (!chapters.length) return;

        const prefersReducedMotion =
            window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

        function openChapter(target) {
            chapters.forEach((chapter) => {
                if (chapter !== target) chapter.open = false;
            });

            target.open = true;

            target.scrollIntoView({
                behavior: prefersReducedMotion ? "auto" : "smooth",
                block: "start"
            });

            const summary = target.querySelector("summary");
            if (summary) summary.focus({ preventScroll: true });
        }

        chapters.forEach((chapter) => {
            chapter.addEventListener("toggle", () => {
                if (!chapter.open) return;

                chapters.forEach((other) => {
                    if (other !== chapter) other.open = false;
                });

                const id = chapter.getAttribute("id");
                if (id) history.replaceState(null, "", `#${id}`);
            });
        });

        container.addEventListener("click", (event) => {
            const link = event.target.closest("a.chapter__jump");
            if (!link) return;

            const href = link.getAttribute("href") || "";
            if (!href.startsWith("#")) return;

            const target = document.getElementById(href.slice(1));
            if (!target || !target.matches("details.chapter")) return;

            event.preventDefault();
            openChapter(target);
            history.replaceState(null, "", href);
        });

        const hashTarget = location.hash ? document.getElementById(location.hash.slice(1)) : null;
        if (hashTarget && hashTarget.matches("details.chapter")) openChapter(hashTarget);
    }

    setCurrentNavLink();
    updateGravidez();
    setupGravidezConfig();
    setupBrokenImages();
    setupChapters();
})();
