(function () {
    'use strict';

    // ============================================================================
    // GUARD - Only run on Omnivox domains
    // ============================================================================
    if (!window.location.href.includes('omnivox.ca')) {
        return;
    }

    // ============================================================================
    // CONSTANTS
    // ============================================================================
    const CONFIG = {
        MAX_CONSECUTIVE_MISSES: 1000,
        REQUEST_DELAY_MS: 100,
        BINARY_SEARCH_DELAY_MS: 30,
        PHOTO_LOAD_DELAY_MS: 50,
        INITIAL_PHOTOS_TO_LOAD: 12,
        HASH_SIMILARITY_THRESHOLD: 0.2,
        MIN_FILTER_QUERY_LENGTH: 2,
        TOAST_DURATION_MS: 3000,
        SEMESTER_START_YEAR: 2005
    };

    const ENDPOINTS = {
        SEARCH: '/WebApplication/Commun.SelectionIndividu/Prive/SelectionIndividu.asmx/LancerRecherche',
        GET_STUDENTS: '/WebApplication/Commun.SelectionIndividu/Prive/SelectionIndividu.asmx/GetListeItemCategorie',
        PHOTO: '/WebApplication/Module.PHOE/Etudiant/PhotoEtudiant.ashx',
        PHOTO_FALLBACK: '/WebApplication/Module.MIOE/Commun/Message/PhotoEtudiant.ashx'
    };

    // ============================================================================
    // CSS STYLES
    // ============================================================================
    const CSS_STYLES = `
        :root {
            --ovxps-bg: #ffffff;
            --ovxps-fg: #0f172a;
            --ovxps-muted: #64748b;
            --ovxps-primary: #3b82f6;
            --ovxps-primary-600: #2563eb;
            --ovxps-primary-hover: #1d4ed8;
            --ovxps-border: #e2e8f0;
            --ovxps-overlay: rgba(15, 23, 42, 0.65);
            --ovxps-danger: #ef4444;
            --ovxps-success: #16a34a;
            --ovxps-warning: #f59e0b;
            --ovxps-shadow: 0 10px 25px rgba(0, 0, 0, 0.12);
            --ovxps-shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.08);
            --ovxps-radius-sm: 4px;
            --ovxps-radius-md: 6px;
            --ovxps-radius-lg: 8px;
            --ovxps-sidebar-width: 260px;
            --ovxps-transition: 180ms cubic-bezier(0.4, 0, 0.2, 1);
        }

        @keyframes ovxps-fade-in {
            from { opacity: 0; }
            to { opacity: 1; }
        }

        @keyframes ovxps-modal-in {
            to {
                opacity: 1;
                transform: translate(-50%, -50%) scale(1);
            }
        }

        @keyframes ovxps-shake {
            10%, 90% { transform: translateX(-1px); }
            20%, 80% { transform: translateX(2px); }
            30%, 70% { transform: translateX(-2px); }
            40%, 60% { transform: translateX(1px); }
            50% { transform: translateX(0); }
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        @keyframes ovxps-toast-in {
            from {
                opacity: 0;
                transform: translateY(10px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        @keyframes ovxps-highlight-pulse {
            0% { box-shadow: 0 0 0 3px var(--ovxps-warning); }
            50% { box-shadow: 0 0 0 6px rgba(245, 158, 11, 0.3); }
            100% { box-shadow: 0 0 0 3px var(--ovxps-warning); }
        }

        /* Base button styles */
        .ovxps-btn {
            border: 0;
            border-radius: var(--ovxps-radius-md);
            cursor: pointer;
            font-weight: 600;
            transition: all 0.2s var(--ovxps-transition);
            outline: 0;
        }

        .ovxps-btn:focus-visible {
            outline: 2px solid var(--ovxps-primary);
            outline-offset: 2px;
        }

        /* Base input styles */
        .ovxps-input {
            box-sizing: border-box;
            width: 100%;
            height: 36px;
            padding: 0 10px;
            border: 1px solid var(--ovxps-border);
            border-radius: var(--ovxps-radius-md);
            font-size: 13px;
            outline: 0;
            background: var(--ovxps-bg);
            color: var(--ovxps-fg);
            transition: border 0.2s, box-shadow 0.2s;
        }

        .ovxps-input:hover {
            border-color: var(--ovxps-primary-600);
        }

        .ovxps-input:focus {
            border-color: var(--ovxps-primary);
            box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
        }

        .ovxps-input:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            background: rgba(0, 0, 0, 0.04);
        }

        /* Main search button */
        #photo-search-button {
            position: fixed;
            top: 12px;
            right: 12px;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 10px 16px;
            font-size: 14px;
            background: var(--ovxps-primary);
            color: #fff;
            box-shadow: var(--ovxps-shadow);
            z-index: 10000;
            border: 0;
            border-radius: var(--ovxps-radius-md);
            cursor: pointer;
            font-weight: 600;
        }

        #photo-search-button:hover {
            background: var(--ovxps-primary-hover);
            transform: translateY(-2px);
        }

        #photo-search-button svg {
            width: 18px;
            height: 18px;
        }

        /* Modal overlay */
        #photo-search-overlay {
            display: none;
            position: fixed;
            inset: 0;
            background: var(--ovxps-overlay);
            backdrop-filter: blur(2px);
            z-index: 10000;
        }

        #photo-search-overlay[aria-hidden=false] {
            display: block;
            animation: 0.25s forwards ovxps-fade-in;
        }

        /* Modal container */
        .ovxps-modal {
            position: absolute;
            inset: 50% auto auto 50%;
            transform: translate(-50%, -50%) scale(0.95);
            opacity: 0;
            width: min(1100px, 94vw);
            height: min(90vh, 780px);
            min-height: 400px;
            border-radius: var(--ovxps-radius-lg);
            box-shadow: var(--ovxps-shadow), 0 0 0 1px var(--ovxps-border);
            overflow: hidden;
            display: flex;
            flex-direction: column;
            background: var(--ovxps-bg);
            animation: 0.3s forwards ovxps-modal-in;
        }

        /* Modal header */
        .ovxps-modal-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 14px 16px;
            border-bottom: 1px solid var(--ovxps-border);
            flex-shrink: 0;
        }

        .ovxps-title {
            font-size: 16px;
            font-weight: 700;
            margin: 0;
            color: var(--ovxps-fg);
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .ovxps-title svg {
            width: 20px;
            height: 20px;
            color: var(--ovxps-primary);
        }

        .ovxps-close {
            width: 32px;
            height: 32px;
            background: transparent;
            border: none;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            color: var(--ovxps-muted);
            transition: all 0.2s;
        }

        .ovxps-close:hover {
            background: rgba(148, 163, 184, 0.15);
            color: var(--ovxps-fg);
        }

        .ovxps-close svg {
            width: 18px;
            height: 18px;
        }

        /* Modal body */
        .ovxps-modal-body {
            display: flex;
            flex: 1;
            min-height: 0;
        }

        /* Sidebar */
        .ovxps-sidebar {
            width: var(--ovxps-sidebar-width);
            border-right: 1px solid var(--ovxps-border);
            padding: 16px;
            display: flex;
            flex-direction: column;
            gap: 20px;
            flex-shrink: 0;
            overflow-y: auto;
            background: linear-gradient(180deg, rgba(0, 0, 0, 0.01), transparent);
        }

        .ovxps-sidebar-section {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }

        .ovxps-sidebar-title {
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: var(--ovxps-muted);
            margin: 0;
        }

        .ovxps-sidebar-field {
            display: flex;
            flex-direction: column;
            gap: 6px;
        }

        .ovxps-sidebar-label {
            font-size: 12px;
            font-weight: 600;
            color: var(--ovxps-muted);
        }

        .ovxps-sidebar-divider {
            height: 1px;
            background: var(--ovxps-border);
            margin: 4px 0;
        }

        /* Mode buttons */
        .ovxps-mode-list {
            display: flex;
            flex-direction: column;
            gap: 4px;
        }

        .ovxps-mode-btn {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px 12px;
            background: transparent;
            border: 1px solid transparent;
            border-radius: var(--ovxps-radius-md);
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
            color: var(--ovxps-fg);
            text-align: left;
            transition: all 0.15s;
        }

        .ovxps-mode-btn:hover {
            background: rgba(59, 130, 246, 0.05);
            border-color: var(--ovxps-border);
        }

        .ovxps-mode-btn.active {
            background: rgba(59, 130, 246, 0.1);
            border-color: var(--ovxps-primary);
            color: var(--ovxps-primary);
        }

        .ovxps-mode-btn svg {
            width: 18px;
            height: 18px;
            flex-shrink: 0;
            opacity: 0.7;
        }

        .ovxps-mode-btn.active svg {
            opacity: 1;
        }

        /* Select dropdown */
        .ovxps-select {
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
            background-repeat: no-repeat;
            background-position: right 8px center;
            padding-right: 28px;
            appearance: none;
        }

        /* Search button */
        .ovxps-search-btn {
            width: 100%;
            padding: 10px;
            background: var(--ovxps-primary);
            color: #fff;
            border: none;
            border-radius: var(--ovxps-radius-md);
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            transition: background 0.2s;
        }

        .ovxps-search-btn:hover {
            background: var(--ovxps-primary-hover);
        }

        .ovxps-search-btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }

        .ovxps-search-btn svg {
            width: 16px;
            height: 16px;
        }

        /* Stats section */
        .ovxps-stats {
            display: flex;
            flex-direction: column;
            gap: 8px;
            padding: 12px;
            background: rgba(59, 130, 246, 0.05);
            border-radius: var(--ovxps-radius-md);
            border: 1px solid rgba(59, 130, 246, 0.1);
        }

        .ovxps-stat {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 12px;
        }

        .ovxps-stat-label {
            color: var(--ovxps-muted);
        }

        .ovxps-stat-value {
            font-weight: 700;
            color: var(--ovxps-primary);
        }

        .ovxps-progress-bar {
            height: 4px;
            background: var(--ovxps-border);
            border-radius: 2px;
            overflow: hidden;
            margin-top: 4px;
        }

        .ovxps-progress-fill {
            height: 100%;
            background: var(--ovxps-primary);
            transition: width 0.3s;
        }

        .ovxps-stop-btn {
            width: 100%;
            padding: 8px;
            background: var(--ovxps-danger);
            color: #fff;
            border: none;
            border-radius: var(--ovxps-radius-md);
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            margin-top: 8px;
        }

        .ovxps-stop-btn:hover {
            opacity: 0.9;
        }

        .ovxps-stop-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        /* Main content area */
        .ovxps-main {
            flex: 1;
            display: flex;
            flex-direction: column;
            min-width: 0;
        }

        .ovxps-main-header {
            padding: 12px 16px;
            border-bottom: 1px solid var(--ovxps-border);
            display: flex;
            align-items: center;
            gap: 12px;
            flex-shrink: 0;
        }

        .ovxps-filter-input {
            flex: 1;
            height: 38px;
            font-size: 14px;
        }

        .ovxps-clear-highlights-btn {
            margin-left: 8px;
            white-space: nowrap;
            gap: 4px;
        }

        .ovxps-results {
            flex: 1;
            overflow-y: auto;
            padding: 16px;
            scroll-behavior: smooth;
        }

        /* Grid layout */
        .ovxps-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
            gap: 12px;
        }

        /* Student card */
        .ovxps-card {
            background: var(--ovxps-bg);
            border: 1px solid var(--ovxps-border);
            border-radius: var(--ovxps-radius-md);
            overflow: hidden;
            transition: all 0.2s;
        }

        .ovxps-card:hover {
            transform: translateY(-2px);
            box-shadow: var(--ovxps-shadow);
        }

        .ovxps-card.highlighted {
            box-shadow: 0 0 0 3px var(--ovxps-warning);
            z-index: 10;
            animation: ovxps-highlight-pulse 1.5s ease-out;
        }

        .ovxps-photo {
            width: 100%;
            height: 160px;
            object-fit: cover;
            display: block;
            cursor: pointer;
            transition: opacity 0.2s;
        }

        .ovxps-photo:hover {
            opacity: 0.9;
        }

        .ovxps-card-body {
            padding: 10px;
        }

        .ovxps-student-name {
            font-weight: 600;
            font-size: 13px;
            margin: 0 0 2px;
            color: var(--ovxps-fg);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .ovxps-student-noda {
            font-size: 11px;
            color: var(--ovxps-muted);
            margin: 0;
        }

        /* Course section */
        .ovxps-course-section {
            margin-bottom: 12px;
            border: 1px solid var(--ovxps-border);
            border-radius: var(--ovxps-radius-md);
            overflow: hidden;
        }

        .ovxps-course-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px 14px;
            background: var(--ovxps-bg);
            cursor: pointer;
            transition: background 0.15s;
        }

        .ovxps-course-header:hover {
            background: rgba(59, 130, 246, 0.03);
        }

        .ovxps-course-header[aria-expanded=true] {
            background: rgba(59, 130, 246, 0.05);
            border-bottom: 1px solid var(--ovxps-border);
        }

        .ovxps-course-header-left {
            display: flex;
            align-items: center;
            gap: 10px;
            flex: 1;
            min-width: 0;
        }

        .ovxps-course-toggle {
            width: 20px;
            height: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
        }

        .ovxps-course-toggle svg {
            width: 14px;
            height: 14px;
            color: var(--ovxps-muted);
            transition: transform 0.2s;
        }

        .ovxps-course-header[aria-expanded=true] .ovxps-course-toggle svg {
            transform: rotate(180deg);
        }

        .ovxps-course-title {
            font-weight: 600;
            font-size: 14px;
            margin: 0;
            color: var(--ovxps-fg);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .ovxps-course-count {
            background: var(--ovxps-primary);
            color: #fff;
            padding: 2px 8px;
            border-radius: 10px;
            font-size: 11px;
            font-weight: 600;
            flex-shrink: 0;
        }

        .ovxps-course-ids {
            font-size: 10px;
            color: var(--ovxps-muted);
            font-family: monospace;
            background: rgba(0, 0, 0, 0.05);
            padding: 2px 6px;
            border-radius: var(--ovxps-radius-sm);
            cursor: pointer;
            flex-shrink: 0;
        }

        .ovxps-course-ids:hover {
            background: rgba(59, 130, 246, 0.1);
            color: var(--ovxps-primary);
        }

        .ovxps-course-content {
            padding: 12px;
        }

        /* Loading spinner */
        .ovxps-spinner {
            animation: 1s linear infinite spin;
        }

        /* Welcome screen */
        .ovxps-welcome {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            padding: 32px;
            text-align: center;
            color: var(--ovxps-muted);
        }

        .ovxps-welcome svg {
            width: 64px;
            height: 64px;
            margin-bottom: 20px;
            opacity: 0.5;
            color: var(--ovxps-primary);
        }

        .ovxps-welcome-title {
            font-size: 18px;
            font-weight: 700;
            color: var(--ovxps-fg);
            margin-bottom: 8px;
        }

        .ovxps-welcome-text {
            font-size: 14px;
            max-width: 300px;
            line-height: 1.5;
        }

        /* Loading state */
        .ovxps-loading {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 48px;
            text-align: center;
        }

        .ovxps-loading svg {
            width: 40px;
            height: 40px;
            margin-bottom: 16px;
            color: var(--ovxps-primary);
        }

        .ovxps-loading-text {
            font-weight: 600;
            color: var(--ovxps-fg);
            font-size: 14px;
        }

        /* No results state */
        .ovxps-no-results {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 48px;
            text-align: center;
            color: var(--ovxps-muted);
        }

        .ovxps-no-results svg {
            width: 48px;
            height: 48px;
            margin-bottom: 16px;
            opacity: 0.5;
        }

        .ovxps-no-results-title {
            font-size: 16px;
            font-weight: 600;
            color: var(--ovxps-fg);
        }

        /* Error message */
        #error-message {
            padding: 10px 16px;
            color: var(--ovxps-danger);
            font-weight: 600;
            font-size: 13px;
            display: none;
            background: rgba(239, 68, 68, 0.08);
            border-bottom: 1px solid rgba(239, 68, 68, 0.2);
        }

        #error-message.is-visible {
            display: block;
        }

        /* Export buttons */
        .ovxps-export-btns {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            margin-top: 8px;
        }

        .ovxps-export-btn {
            flex: 1;
            min-width: calc(50% - 3px);
            padding: 8px 6px;
            background: var(--ovxps-bg);
            color: var(--ovxps-primary);
            border: 1px solid var(--ovxps-primary);
            border-radius: var(--ovxps-radius-sm);
            font-size: 11px;
            font-weight: 600;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
            transition: all 0.15s;
        }

        .ovxps-export-btn:hover {
            background: var(--ovxps-primary);
            color: #fff;
        }

        .ovxps-export-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .ovxps-export-btn svg {
            width: 14px;
            height: 14px;
        }

        /* Filter results */
        .ovxps-filter-results {
            background: rgba(59, 130, 246, 0.05);
            border: 1px solid rgba(59, 130, 246, 0.15);
            border-radius: var(--ovxps-radius-md);
            padding: 12px;
            margin-bottom: 16px;
        }

        .ovxps-filter-header {
            font-size: 13px;
            font-weight: 600;
            margin-bottom: 10px;
            color: var(--ovxps-fg);
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .ovxps-filter-count {
            background: var(--ovxps-primary);
            color: #fff;
            padding: 2px 8px;
            border-radius: 10px;
            font-size: 11px;
        }

        .ovxps-filter-student {
            background: var(--ovxps-bg);
            border: 1px solid var(--ovxps-border);
            border-radius: var(--ovxps-radius-md);
            padding: 10px;
            margin-bottom: 8px;
            cursor: context-menu;
        }

        .ovxps-filter-student:hover {
            border-color: var(--ovxps-primary);
        }

        .ovxps-filter-student:last-child {
            margin-bottom: 0;
        }

        .ovxps-filter-student-name {
            font-weight: 600;
            font-size: 13px;
            color: var(--ovxps-fg);
            margin-bottom: 6px;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .ovxps-filter-student-photo {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            object-fit: cover;
        }

        .ovxps-filter-classes {
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
        }

        .ovxps-filter-class-tag {
            background: var(--ovxps-primary);
            color: #fff;
            padding: 3px 8px;
            border-radius: 10px;
            font-size: 10px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.15s;
        }

        .ovxps-filter-class-tag:hover {
            background: var(--ovxps-primary-hover);
            transform: scale(1.05);
        }

        /* Toast notification */
        .ovxps-toast {
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 12px 20px;
            background: var(--ovxps-fg);
            color: var(--ovxps-bg);
            border-radius: var(--ovxps-radius-md);
            font-size: 13px;
            font-weight: 500;
            z-index: 10003;
            animation: ovxps-toast-in 0.3s forwards;
        }

        /* Context menu */
        .ovxps-context-menu {
            position: fixed;
            background: var(--ovxps-bg);
            border: 1px solid var(--ovxps-border);
            border-radius: var(--ovxps-radius-md);
            box-shadow: var(--ovxps-shadow);
            z-index: 10004;
            min-width: 160px;
            padding: 4px 0;
        }

        .ovxps-context-item {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 12px;
            font-size: 12px;
            color: var(--ovxps-fg);
            cursor: pointer;
            transition: background 0.1s;
        }

        .ovxps-context-item:hover {
            background: rgba(59, 130, 246, 0.1);
        }

        .ovxps-context-item svg {
            width: 14px;
            height: 14px;
            color: var(--ovxps-muted);
        }

        .ovxps-context-divider {
            height: 1px;
            background: var(--ovxps-border);
            margin: 4px 0;
        }

        /* Responsive styles */
        @media (max-width: 700px) {
            .ovxps-modal {
                width: 100%;
                height: 100%;
                border-radius: 0;
            }

            .ovxps-modal-body {
                flex-direction: column;
            }

            .ovxps-sidebar {
                width: 100%;
                border-right: none;
                border-bottom: 1px solid var(--ovxps-border);
                max-height: 200px;
            }

            .ovxps-grid {
                grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
            }
        }

        /* Dark mode */
        @media (prefers-color-scheme: dark) {
            :root {
                --ovxps-bg: #0f172a;
                --ovxps-fg: #e2e8f0;
                --ovxps-muted: #94a3b8;
                --ovxps-primary: #60a5fa;
                --ovxps-primary-600: #3b82f6;
                --ovxps-primary-hover: #3b82f6;
                --ovxps-border: #1e293b;
                --ovxps-overlay: rgba(2, 6, 23, 0.85);
                --ovxps-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
                --ovxps-shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.3);
            }

            .ovxps-select {
                background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
            }

            .ovxps-course-ids {
                background: rgba(255, 255, 255, 0.1);
            }
        }
    `;

    // ============================================================================
    // SVG ICONS
    // ============================================================================
    const ICONS = {
        search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.35-4.35"></path></svg>`,
        close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"></path></svg>`,
        user: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`,
        book: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>`,
        globe: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10 15 15 0 0 1 4-10z"></path><path d="M2 12h20"></path></svg>`,
        chevronDown: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"></path></svg>`,
        download: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"></path></svg>`,
        upload: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 15v4c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2v-4M17 8l-5-5-5 5M12 3v12"></path></svg>`,
        file: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><path d="M14 2v6h6M8 13h2M8 17h2M14 13h2M14 17h2"></path></svg>`,
        fileJson: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><path d="M14 2v6h6M12 18v-6M9 15l3 3 3-3"></path></svg>`,
        save: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>`,
        users: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"></path></svg>`,
        grid: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>`,
        highlight: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"></path></svg>`,
        arrowLeft: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"></path></svg>`,
        spinner: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="ovxps-spinner"><circle cx="12" cy="12" r="10"></circle><path d="M12 2a10 10 0 0 1 10 10"></path></svg>`,
        image: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>`
    };

    // ============================================================================
    // HTML TEMPLATES
    // ============================================================================
    const TEMPLATES = {
        /**
         * Main modal template
         */
        modal: `
            <div class="ovxps-modal">
                <div class="ovxps-modal-header">
                    <h2 class="ovxps-title">
                        ${ICONS.search}
                        Recherche de Photos
                    </h2>
                    <button class="ovxps-close" aria-label="Fermer">${ICONS.close}</button>
                </div>
                <div id="error-message"></div>
                <div class="ovxps-modal-body">
                    <div class="ovxps-sidebar">
                        <div class="ovxps-sidebar-section">
                            <div class="ovxps-sidebar-title">Mode</div>
                            <div class="ovxps-mode-list">
                                <button class="ovxps-mode-btn active" data-mode="name">
                                    ${ICONS.user}
                                    Par nom
                                </button>
                                <button class="ovxps-mode-btn" data-mode="session">
                                    ${ICONS.book}
                                    Mes cours
                                </button>
                                <button class="ovxps-mode-btn" data-mode="id">
                                    ${ICONS.globe}
                                    Tout explorer
                                </button>
                            </div>
                        </div>

                        <div class="ovxps-sidebar-divider"></div>

                        <div class="ovxps-sidebar-section" id="name-field">
                            <div class="ovxps-sidebar-field">
                                <label class="ovxps-sidebar-label">Nom</label>
                                <input type="text" id="student-name" class="ovxps-input" placeholder="Nom de l'etudiant...">
                            </div>
                        </div>

                        <div class="ovxps-sidebar-section" id="session-field" style="display:none;">
                            <div class="ovxps-sidebar-field">
                                <label class="ovxps-sidebar-label">Session</label>
                                <select id="session-select" class="ovxps-input ovxps-select">
                                    <option value="">Choisir...</option>
                                </select>
                            </div>
                        </div>

                        <div class="ovxps-sidebar-section" id="id-fields" style="display:none;">
                            <div class="ovxps-sidebar-field">
                                <label class="ovxps-sidebar-label">Session</label>
                                <select id="enum-session-select" class="ovxps-input ovxps-select">
                                    <option value="">Choisir...</option>
                                </select>
                            </div>
                        </div>

                        <button id="search-btn" class="ovxps-search-btn">
                            ${ICONS.search}
                            Rechercher
                        </button>

                        <button id="load-session-btn-main" class="ovxps-search-btn" style="background:var(--ovxps-success);margin-top:8px;display:none">
                            ${ICONS.upload}
                            Charger session
                        </button>
                        <input type="file" id="load-session-input-main" accept=".json" style="display:none">

                        <div class="ovxps-sidebar-section" id="stats-section" style="display:none;">
                            <div class="ovxps-sidebar-divider"></div>
                            <div class="ovxps-stats">
                                <div class="ovxps-stat">
                                    <span class="ovxps-stat-label">Classes</span>
                                    <span class="ovxps-stat-value" id="stat-classes">0</span>
                                </div>
                                <div class="ovxps-stat">
                                    <span class="ovxps-stat-label">ID actuel</span>
                                    <span class="ovxps-stat-value" id="stat-current-id">-</span>
                                </div>
                                <div class="ovxps-progress-bar">
                                    <div class="ovxps-progress-fill" id="progress-fill" style="width:0%"></div>
                                </div>
                            </div>
                            <button class="ovxps-stop-btn" id="enum-stop-btn">Arreter</button>
                        </div>

                        <div class="ovxps-sidebar-section" id="export-section" style="display:none;">
                            <div class="ovxps-sidebar-divider"></div>
                            <div class="ovxps-sidebar-title">Export</div>
                            <div class="ovxps-export-btns">
                                <button class="ovxps-export-btn" id="export-csv-btn" title="Exporter en CSV">
                                    ${ICONS.file}
                                    CSV
                                </button>
                                <button class="ovxps-export-btn" id="export-json-btn" title="Exporter en JSON">
                                    ${ICONS.fileJson}
                                    JSON
                                </button>
                                <button class="ovxps-export-btn" id="download-photos-btn" title="Telecharger toutes les photos">
                                    ${ICONS.download}
                                    Photos
                                </button>
                            </div>
                            <div class="ovxps-sidebar-divider" style="margin:8px 0"></div>
                            <div class="ovxps-sidebar-title">Session</div>
                            <div class="ovxps-export-btns">
                                <button class="ovxps-export-btn" id="save-session-btn" title="Sauvegarder la session">
                                    ${ICONS.save}
                                    Sauvegarder
                                </button>
                                <button class="ovxps-export-btn" id="load-session-btn" title="Charger une session">
                                    ${ICONS.upload}
                                    Charger
                                </button>
                            </div>
                            <input type="file" id="load-session-input" accept=".json" style="display:none">
                        </div>
                    </div>

                    <div class="ovxps-main">
                        <div class="ovxps-main-header">
                            <input type="text" id="filter-input" class="ovxps-input ovxps-filter-input" placeholder="Filtrer les resultats...">
                            <button id="clear-highlights-btn" class="ovxps-btn ovxps-btn-secondary ovxps-clear-highlights-btn" style="display:none;">
                                ${ICONS.close} Effacer
                            </button>
                        </div>
                        <div class="ovxps-results" id="results"></div>
                    </div>
                </div>
            </div>
        `,

        searchButton: `${ICONS.search} Photos`,

        welcome: `
            <div class="ovxps-welcome">
                ${ICONS.search}
                <h3 class="ovxps-welcome-title">Recherche de photos</h3>
                <p class="ovxps-welcome-text">Selectionnez un mode dans la barre laterale et lancez votre recherche.</p>
            </div>
        `,

        loading: `
            <div class="ovxps-loading">
                ${ICONS.spinner}
                <p class="ovxps-loading-text">Recherche en cours...</p>
            </div>
        `,

        noResults: `
            <div class="ovxps-no-results">
                ${ICONS.search}
                <h3 class="ovxps-no-results-title">Aucun resultat</h3>
            </div>
        `,

        errorMessage: (message) => `<div class="ovxps-error">${message}</div>`,

        /**
         * Student card template
         * @param {Object} data - Student card data
         */
        studentGridCard: (data) => `
            <div class="ovxps-card">
                <img class="ovxps-photo"
                     src="${data.avatarUrl}"
                     data-photo-url="${data.photoUrl}"
                     data-fallback-url="${data.fallbackPhotoUrl}"
                     data-initials-fallback="${data.initialsFallbackUrl}"
                     data-name="${data.name}"
                     data-noda="${data.imageLink}"
                     alt="Photo de ${data.displayName}"
                     loading="lazy">
                <div class="ovxps-card-body">
                    <h4 class="ovxps-student-name">${data.displayName}</h4>
                    ${data.programme ? `<p class="ovxps-student-noda">${data.programme}</p>` : ''}
                </div>
            </div>
        `,

        /**
         * Course section template
         * @param {Object} data - Course data
         */
        courseSection: (data) => `
            <div class="ovxps-course-section" data-course-id="${data.courseId}">
                <div class="ovxps-course-header" aria-expanded="false">
                    <div class="ovxps-course-header-left">
                        <div class="ovxps-course-toggle">${ICONS.chevronDown}</div>
                        <h3 class="ovxps-course-title">${data.courseTitle}</h3>
                        ${data.count ? `<span class="ovxps-course-count">${data.count}</span>` : ''}
                    </div>
                    ${data.anSession && data.idGroupe ? `<span class="ovxps-course-ids">${data.anSession}:${data.idGroupe}</span>` : ''}
                </div>
                <div class="ovxps-course-content" id="course-${data.courseId}" style="display:none;">
                    <div class="ovxps-loading">
                        ${ICONS.spinner}
                        <p class="ovxps-loading-text">Chargement...</p>
                    </div>
                </div>
            </div>
        `,

        sessionOption: (data) => `<option value="${Utils.escapeAttr(data.value)}">${Utils.escapeHtml(data.text)}</option>`,

        courseStudents: (data) => `<div class="ovxps-grid">${data.studentsHtml}</div>`,

        courseContentError: `
            <div class="ovxps-no-results">
                <div style="font-size: 14px; color: var(--ovxps-danger);">Erreur lors du chargement des etudiants</div>
            </div>
        `,

        directSearchResult: (data) => `<div class="ovxps-grid">${data.studentsHtml}</div>`,

        enumerationProgress: () => `
            <div id="filter-results" style="display:none;"></div>
            <div id="enum-results"></div>
        `,

        /**
         * Enumerated class section template
         * @param {Object} data - Class data
         */
        enumeratedClass: (data) => `
            <div class="ovxps-course-section" data-idgroupe="${data.idGroupe}">
                <div class="ovxps-course-header" aria-expanded="false">
                    <div class="ovxps-course-header-left">
                        <div class="ovxps-course-toggle">${ICONS.chevronDown}</div>
                        <h3 class="ovxps-course-title">Groupe ${data.idGroupe}</h3>
                        <span class="ovxps-course-count">${data.studentCount}</span>
                    </div>
                    <span class="ovxps-course-ids">${data.anSession}:${data.idGroupe}</span>
                </div>
                <div class="ovxps-course-content" style="display:none;">
                    <div class="ovxps-grid">${data.studentsHtml}</div>
                </div>
            </div>
        `,

        filterResults: (data) => `
            <div class="ovxps-filter-results">
                <div class="ovxps-filter-header">
                    <span>"${Utils.escapeHtml(data.query)}"</span>
                    <span class="ovxps-filter-count">${data.students.length}</span>
                </div>
                ${data.students.map(student => TEMPLATES.filterStudentResult(student)).join('')}
            </div>
        `,

        filterStudentResult: (data) => `
            <div class="ovxps-filter-student" data-name="${Utils.escapeAttr(data.name)}" data-noda="${Utils.escapeAttr(data.noda)}" data-photo-url="${Utils.escapeAttr(data.photoUrl)}">
                <div class="ovxps-filter-student-name">
                    <img class="ovxps-filter-student-photo" src="${data.avatarUrl}" data-photo-url="${data.photoUrl}" alt="">
                    <span>${data.displayName}</span>
                </div>
                <div class="ovxps-filter-classes">
                    ${data.classes.map(cls => `<span class="ovxps-filter-class-tag" data-idgroupe="${cls.idGroupe}" title="Cliquer pour voir">Groupe ${cls.idGroupe} (${cls.studentCount})</span>`).join('')}
                </div>
            </div>
        `,

        /**
         * Student context menu template
         * @param {Object} data - Position data
         */
        contextMenu: (data) => `
            <div class="ovxps-context-menu" style="left:${data.x}px;top:${data.y}px">
                ${data.showFindAllClasses ? `
                <div class="ovxps-context-item" data-action="find-all-classes">
                    ${ICONS.users}
                    Voir toutes les classes
                </div>` : ''}
                <div class="ovxps-context-item" data-action="detect-program">
                    ${ICONS.search}
                    Detecter le programme
                </div>
                <div class="ovxps-context-item" data-action="highlight">
                    ${ICONS.highlight}
                    Surligner partout
                </div>
                <div class="ovxps-context-divider"></div>
                <div class="ovxps-context-item" data-action="download">
                    ${ICONS.download}
                    Telecharger photo
                </div>
            </div>
        `,

        /**
         * Class context menu template
         * @param {Object} data - Position data
         */
        classContextMenu: (data) => `
            <div class="ovxps-context-menu" style="left:${data.x}px;top:${data.y}px">
                <div class="ovxps-context-item" data-action="detect-all-programs">
                    ${ICONS.search}
                    Detecter tous les programmes
                </div>
                <div class="ovxps-context-item" data-action="export-class">
                    ${ICONS.file}
                    Exporter cette classe
                </div>
                <div class="ovxps-context-item" data-action="download-all-photos">
                    ${ICONS.download}
                    Telecharger toutes les photos
                </div>
                <div class="ovxps-context-divider"></div>
                <div class="ovxps-context-item" data-action="download-class-image">
                    ${ICONS.image}
                    Telecharger en image
                </div>
            </div>
        `,

        nameSearchResults: (data) => `
            <div style="padding:16px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
                    <h3 style="font-size:15px;font-weight:700;margin:0;color:var(--ovxps-fg)">${data.count} resultat(s) pour "${Utils.escapeHtml(data.query)}"</h3>
                </div>
                <div class="ovxps-grid">${data.studentsHtml}</div>
            </div>
        `
    };

    // ============================================================================
    // UTILITY FUNCTIONS
    // ============================================================================
    const Utils = {
        /**
         * Escape HTML special characters
         * @param {string} str - String to escape
         * @returns {string} Escaped string
         */
        escapeHtml: (() => {
            const entityMap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
            const regex = /[&<>"']/g;
            return str => String(str || '').replace(regex, char => entityMap[char]);
        })(),

        /**
         * Escape attribute value
         * @param {string} str - String to escape
         * @returns {string} Escaped string
         */
        escapeAttr: str => String(str || '').replace(/"/g, '&quot;'),

        /**
         * Format name from "Last, First" to "First Last"
         * @param {string} name - Name to format
         * @returns {string} Formatted name
         */
        formatNameClassic: name => {
            const fullName = String(name || '').trim();
            if (!fullName) return '';

            if (fullName.includes(',')) {
                const parts = fullName.split(',').map(part => part.trim()).filter(Boolean);
                if (parts.length >= 2) {
                    return `${parts[1]} ${parts[0]}`;
                }
            }
            return fullName;
        },

        /**
         * Extract subdomain from URL
         * @param {string} url - URL to parse
         * @returns {string} Subdomain
         */
        getSubdomain: url => {
            try {
                return new URL(url).hostname.split('.')[0];
            } catch {
                return '';
            }
        },

        /**
         * Get IdRechercheIndividu from page
         * @returns {string} ID or empty string
         */
        getIdRechercheIndividu: () => {
            const regex = /IdRechercheIndividu\s*=\s*(\d+);/;
            const match = document.body.innerHTML.match(regex);
            if (match) return match[1];

            for (const script of document.querySelectorAll('script')) {
                const scriptMatch = script.textContent?.match(/idRechercheIndividu['"]\s*:\s*['"]([^'"]+)['"]/);
                if (scriptMatch) return scriptMatch[1];
            }
            return '';
        },

        /**
         * Display error message in modal
         * @param {string} message - Error message or empty to clear
         */
        setErrorMessage: message => {
            const errorDiv = document.getElementById('error-message');
            if (!errorDiv) return;

            if (message) {
                errorDiv.innerHTML = TEMPLATES.errorMessage(Utils.escapeHtml(message));
                errorDiv.classList.add('is-visible');
            } else {
                errorDiv.innerHTML = '';
                errorDiv.classList.remove('is-visible');
            }
        },

        /**
         * Generate avatar data URL with initials
         * @param {string} name - Person's name
         * @returns {string} Data URL
         */
        avatarDataUrl: name => {
            const initials = Utils.getInitials(name);
            const canvas = document.createElement('canvas');
            canvas.width = 120;
            canvas.height = 160;
            const ctx = canvas.getContext('2d');

            ctx.fillStyle = '#e2e8f0';
            ctx.fillRect(0, 0, 120, 160);
            ctx.fillStyle = '#64748b';
            ctx.font = 'bold 24px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(initials, 60, 80);

            return canvas.toDataURL();
        },

        /**
         * Get initials from name
         * @param {string} name - Person's name
         * @returns {string} Initials
         */
        getInitials: name => {
            if (!name) return '?';
            const words = name.trim().split(/\s+/);
            if (words.length === 1) return words[0].charAt(0).toUpperCase();
            return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
        },

        /**
         * Sanitize filename for download
         * @param {string} filename - Filename to sanitize
         * @returns {string} Safe filename
         */
        sanitizeFileName: filename => filename.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '_'),

        /**
         * Generate student card data object
         * @param {Object} student - Student object
         * @returns {Object} Card data
         */
        generateStudentCardData: student => {
            const displayName = Utils.formatNameClassic(student.nom);
            const subdomain = Utils.getSubdomain(window.location.href);
            const avatarUrl = Utils.avatarDataUrl(student.nom);
            const photoUrl = `https://${subdomain}.omnivox.ca${ENDPOINTS.PHOTO}?NoDA=${student.imageLink}`;
            const fallbackPhotoUrl = `https://${subdomain}.omnivox.ca${ENDPOINTS.PHOTO_FALLBACK}?NoDA=${student.imageLink}`;

            return {
                avatarUrl,
                photoUrl,
                fallbackPhotoUrl,
                initialsFallbackUrl: avatarUrl,
                name: student.nom,
                imageLink: student.imageLink,
                displayName,
                programme: student.programme,
                fileName: Utils.sanitizeFileName(`${displayName}_${student.imageLink}.jpg`)
            };
        },

        /**
         * Generate HTML for student cards
         * @param {Array} students - Array of student objects
         * @returns {string} HTML string
         */
        generateStudentsHtml: students => {
            return students.map(student => {
                const cardData = Utils.generateStudentCardData(student);
                return TEMPLATES.studentGridCard(cardData);
            }).join('');
        },

        /**
         * Parse TagDataSource query string
         * @param {string} tagDataSource - Query string
         * @returns {Object|null} Parsed object
         */
        parseTagDataSource: tagDataSource => {
            if (!tagDataSource) return null;
            const params = new URLSearchParams(tagDataSource);
            return {
                anSession: params.get('AnSession'),
                idGroupe: params.get('IDGroupe')
            };
        },

        /**
         * Copy text to clipboard
         * @param {string} text - Text to copy
         */
        copyToClipboard: text => {
            navigator.clipboard.writeText(text).catch(err => console.error('Failed to copy:', err));
        },

        /**
         * Show toast notification
         * @param {string} message - Message to display
         * @param {number} duration - Duration in ms
         */
        showToast: (message, duration = CONFIG.TOAST_DURATION_MS) => {
            const existing = document.querySelector('.ovxps-toast');
            if (existing) existing.remove();

            const toast = document.createElement('div');
            toast.className = 'ovxps-toast';
            toast.textContent = message;
            document.body.appendChild(toast);

            setTimeout(() => toast.remove(), duration);
        },

        /**
         * Download file with given content
         * @param {string} content - File content
         * @param {string} filename - Filename
         * @param {string} mimeType - MIME type
         */
        downloadFile: (content, filename, mimeType) => {
            const blob = new Blob([content], { type: mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        },

        /**
         * Export groups to CSV format
         * @param {Array} groups - Array of group objects
         * @returns {string} CSV string
         */
        exportToCSV: groups => {
            const headers = ['Nom', 'NoDA', 'Programme', 'Groupe', 'Session'];
            const rows = [headers.join(',')];

            for (const group of groups) {
                for (const student of group.students) {
                    const displayName = Utils.formatNameClassic(student.nom);
                    const row = [
                        `"${displayName.replace(/"/g, '""')}"`,
                        student.imageLink,
                        `"${(student.programme || '').replace(/"/g, '""')}"`,
                        group.idGroupe,
                        group.anSession
                    ];
                    rows.push(row.join(','));
                }
            }
            return rows.join('\n');
        },

        /**
         * Export groups to JSON format
         * @param {Array} groups - Array of group objects
         * @returns {string} JSON string
         */
        exportToJSON: groups => {
            const data = {
                exportDate: new Date().toISOString(),
                totalClasses: groups.length,
                totalStudents: groups.reduce((acc, g) => acc + g.students.length, 0),
                classes: groups.map(group => ({
                    idGroupe: group.idGroupe,
                    anSession: group.anSession,
                    studentCount: group.studentCount,
                    students: group.students.map(s => ({
                        nom: s.nom,
                        displayName: Utils.formatNameClassic(s.nom),
                        noDA: s.imageLink,
                        programme: s.programme || null
                    }))
                }))
            };
            return JSON.stringify(data, null, 2);
        },

        /**
         * Get perceptual hash of image
         * @param {string} url - Image URL
         * @returns {Promise<string|null>} Hash string or null
         */
        async getImageHash(url) {
            try {
                const response = await fetch(url);
                if (!response.ok) return null;

                const blob = await response.blob();
                if (blob.size < 100) return null;

                const bitmap = await createImageBitmap(blob);
                const canvas = document.createElement('canvas');
                canvas.width = 32;
                canvas.height = 32;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(bitmap, 0, 0, 32, 32);

                const imageData = ctx.getImageData(0, 0, 32, 32);
                const data = imageData.data;

                let sum = 0;
                for (let i = 0; i < data.length; i += 4) {
                    sum += (data[i] + data[i + 1] + data[i + 2]) / 3;
                }
                const avg = sum / (data.length / 4);

                let hash = '';
                for (let i = 0; i < data.length; i += 4) {
                    const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
                    hash += gray > avg ? '1' : '0';
                }
                return hash;
            } catch {
                return null;
            }
        },

        /**
         * Calculate Hamming distance between two hashes
         * @param {string} hash1 - First hash
         * @param {string} hash2 - Second hash
         * @returns {number} Distance
         */
        hammingDistance(hash1, hash2) {
            if (!hash1 || !hash2 || hash1.length !== hash2.length) return Infinity;
            let distance = 0;
            for (let i = 0; i < hash1.length; i++) {
                if (hash1[i] !== hash2[i]) distance++;
            }
            return distance;
        }
    };

    // ============================================================================
    // MODELS
    // ============================================================================

    /**
     * Represents a student
     */
    class Student {
        constructor(nom, imageLink, programme = '') {
            this.nom = nom;
            this.imageLink = imageLink;
            this.programme = programme;
        }
    }

    /**
     * Static class for extracting students from API responses
     */
    class Students {
        static extract(data) {
            try {
                let items = [];
                if (data?.d?.ResultatRecherche?.length) {
                    items = data.d.ResultatRecherche;
                } else if (data?.d?.ItemsSelectionnes?.length) {
                    items = data.d.ItemsSelectionnes;
                } else {
                    return [];
                }

                return items.map(item => new Student(
                    item.NomAffichage || item.Titre || '',
                    item.NoDA || item.Numero || '',
                    item.Programme || item.Description || ''
                ));
            } catch {
                return [];
            }
        }
    }

    /**
     * Represents a semester/session
     */
    class Semester {
        constructor(year, session) {
            this.year = year;
            this.session = session;
        }

        getSessionName() {
            const names = { 1: 'Hiver', 2: 'Ete', 3: 'Automne' };
            return names[this.session] || 'Inconnu';
        }

        print() {
            return `${this.getSessionName()} ${this.year}`;
        }

        toString() {
            return `${this.year}${this.session}`;
        }
    }

    /**
     * Generates list of available semesters
     */
    class Semesters {
        constructor() {
            this.sessions = this.generateSemesters();
        }

        generateSemesters() {
            const now = new Date();
            const currentYear = now.getFullYear();
            const currentMonth = now.getMonth() + 1;
            const currentSemester = this.getCurrentSemester(currentYear, currentMonth);
            const semesters = [];

            let sessionIter = currentSemester.session;
            for (let year = currentSemester.year; year >= CONFIG.SEMESTER_START_YEAR; year--) {
                for (let session = sessionIter; session >= 1; session--) {
                    if (year === currentSemester.year && session > currentSemester.session) continue;
                    const semester = new Semester(year, session);
                    semesters.push({ value: semester.toString(), text: semester.print() });
                }
                sessionIter = 3;
            }
            return semesters;
        }

        getCurrentSemester(year, month) {
            let session;
            if (month >= 1 && month <= 4) session = 1;
            else if (month >= 5 && month <= 7) session = 2;
            else session = 3;
            return new Semester(year, session);
        }
    }

    /**
     * Represents a course
     */
    class Course {
        constructor(courseData) {
            Object.assign(this, courseData);
        }

        async getStudents() {
            const service = new CourseService();
            return await service.getStudentsForCourse(this);
        }

        getCourseId() {
            return `course-${this.NoCours}-${this.NoGroupe}`.replace(/[^a-zA-Z0-9-]/g, '-');
        }

        getCourseTitle() {
            return `${this.TitreCours || ''} ${this.NoCours || ''}`.trim();
        }

        getStudentCount() {
            return this.NbEtudiants || 0;
        }

        getTagDataSource() {
            return this.TagDataSourceItem || '';
        }

        getAnSession() {
            return Utils.parseTagDataSource(this.TagDataSourceItem)?.anSession || '';
        }

        getIDGroupe() {
            return Utils.parseTagDataSource(this.TagDataSourceItem)?.idGroupe || '';
        }
    }

    // ============================================================================
    // SERVICES
    // ============================================================================

    /**
     * Base service with common functionality
     */
    class BaseService {
        constructor() {
            this.subdomain = Utils.getSubdomain(window.location.href);
            this.idRechercheIndividu = Utils.getIdRechercheIndividu();
        }

        async fetchWithErrorHandling(url, options, errorMessage) {
            try {
                const response = await fetch(url, options);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return response;
            } catch (error) {
                Utils.setErrorMessage(errorMessage);
                throw error;
            }
        }

        async decodeIsoResponse(response) {
            const buffer = await response.arrayBuffer();
            return new TextDecoder('iso-8859-1').decode(buffer);
        }
    }

    /**
     * Service for searching students by name
     */
    class StudentSearchService extends BaseService {
        async search(name) {
            const url = `https://${this.subdomain}.omnivox.ca${ENDPOINTS.SEARCH}`;
            const requestBody = {
                idRechercheIndividu: this.idRechercheIndividu,
                motCleRecherche: name,
                toujoursAfficherDescription: true
            };

            try {
                const response = await this.fetchWithErrorHandling(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json; charset=iso-8859-1' },
                    body: JSON.stringify(requestBody)
                }, `Erreur lors de la recherche de "${name}"`);

                const text = await this.decodeIsoResponse(response);
                Utils.setErrorMessage('');
                return Students.extract(JSON.parse(text));
            } catch {
                return [];
            }
        }
    }

    /**
     * Service for fetching students for a course
     */
    class CourseService extends BaseService {
        async getStudentsForCourse(course) {
            const url = `https://${this.subdomain}.omnivox.ca${ENDPOINTS.GET_STUDENTS}`;
            const requestBody = {
                idRechercheConfig: this.idRechercheIndividu,
                itemParent: {
                    Description: course.Description,
                    Etat: course.Etat,
                    IndicateurExpanded: course.IndicateurExpanded,
                    IndicateurModifie: course.IndicateurModifie,
                    ModeExpandSeulement: course.ModeExpandSeulement,
                    toujoursAfficherDescription: true,
                    NbEnseignants: course.NbEnseignants,
                    NbEtudiants: course.NbEtudiants,
                    NbIndividus: course.NbIndividus,
                    NoCours: course.NoCours,
                    NoGroupe: course.NoGroupe,
                    Numero: course.Numero,
                    RegroupementDataSource: course.RegroupementDataSource,
                    ServEnseignement_Campus_AnSession: course.ServEnseignement_Campus_AnSession,
                    TagDataSourceItem: course.TagDataSourceItem,
                    TexteAucunIndividu: course.TexteAucunIndividu,
                    TexteLienAjoutTous: course.TexteLienAjoutTous,
                    TexteLienExpandItem: course.TexteLienExpandItem,
                    Titre: course.Titre,
                    TitreCours: course.TitreCours,
                    TypeItemSelectionne: course.TypeItemSelectionne,
                    TypeItemString: course.TypeItemString
                }
            };

            try {
                const response = await this.fetchWithErrorHandling(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json; charset=iso-8859-1' },
                    body: JSON.stringify(requestBody)
                }, `Erreur lors de la recuperation des etudiants pour le cours ${course.getCourseTitle()}`);

                const text = await this.decodeIsoResponse(response);
                Utils.setErrorMessage('');
                return Students.extract(JSON.parse(text));
            } catch {
                return [];
            }
        }
    }

    /**
     * Service for direct ID-based queries
     */
    class DirectCourseService extends BaseService {
        async getStudentsByIds(anSession, idGroupe) {
            const url = `https://${this.subdomain}.omnivox.ca${ENDPOINTS.GET_STUDENTS}`;
            const requestBody = {
                idRechercheConfig: this.idRechercheIndividu,
                itemParent: {
                    RegroupementDataSource: 'CategorieGenerique.MesClassesEtudiantClara',
                    TagDataSourceItem: `AnSession=${anSession}&IDGroupe=${idGroupe}`
                }
            };

            try {
                const response = await this.fetchWithErrorHandling(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json; charset=utf-8',
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    body: JSON.stringify(requestBody)
                }, `Erreur pour AnSession=${anSession}&IDGroupe=${idGroupe}`);

                const text = await this.decodeIsoResponse(response);
                Utils.setErrorMessage('');
                return Students.extract(JSON.parse(text));
            } catch {
                return [];
            }
        }

        /**
         * Find the lowest valid IDGroupe for a session using binary search
         */
        async findLowestIdGroupe(anSession, onStatus = null) {
            const maxId = 100000;
            if (onStatus) onStatus('Recherche de la plage d\'IDs valides...');

            // Try common starting points
            const sessionNum = parseInt(anSession, 10);
            const guesses = [
                Math.floor(sessionNum * 24),
                50000, 40000, 30000, 20000, 10000,
                5000, 2500, 1000, 500, 100, 50, 1
            ];

            let foundValidId = null;
            for (const guess of guesses) {
                if (onStatus) onStatus(`Test ID ${guess}...`);
                const students = await this.getStudentsByIds(anSession, guess.toString());
                if (students.length > 0) {
                    foundValidId = guess;
                    if (onStatus) onStatus(`ID valide trouve: ${guess}`);
                    break;
                }
                await new Promise(r => setTimeout(r, 50));
            }

            // Broader search if needed
            if (foundValidId === null) {
                if (onStatus) onStatus('Recherche etendue...');
                for (let id = 1; id <= maxId; id += 400) {
                    const students = await this.getStudentsByIds(anSession, id.toString());
                    if (students.length > 0) {
                        foundValidId = id;
                        break;
                    }
                    await new Promise(r => setTimeout(r, 50));
                }
            }

            if (foundValidId === null) {
                if (onStatus) onStatus('Aucun ID valide trouve');
                return null;
            }

            // Binary search backwards
            if (onStatus) onStatus(`Recherche du premier ID (a partir de ${foundValidId})...`);
            let low = 1, high = foundValidId, lowestValid = foundValidId;

            while (low < high) {
                const mid = Math.floor((low + high) / 2);
                if (onStatus) onStatus(`Binary search: test ID ${mid}...`);

                const students = await this.getStudentsByIds(anSession, mid.toString());
                if (students.length > 0) {
                    lowestValid = mid;
                    high = mid;
                } else {
                    let foundInRange = false;
                    for (let testId = mid + 1; testId < Math.min(mid + 100, lowestValid); testId += 10) {
                        const testStudents = await this.getStudentsByIds(anSession, testId.toString());
                        if (testStudents.length > 0) {
                            lowestValid = Math.min(lowestValid, testId);
                            high = testId;
                            foundInRange = true;
                            break;
                        }
                    }
                    if (!foundInRange) low = mid + 1;
                }
                await new Promise(r => setTimeout(r, CONFIG.BINARY_SEARCH_DELAY_MS));
            }

            // Final linear search
            if (onStatus) onStatus(`Verification finale a partir de ${lowestValid}...`);
            for (let id = lowestValid - 1; id >= Math.max(1, lowestValid - 50); id--) {
                const students = await this.getStudentsByIds(anSession, id.toString());
                if (students.length > 0) {
                    lowestValid = id;
                } else {
                    let emptyCount = 1;
                    for (let checkId = id - 1; checkId >= Math.max(1, id - 3); checkId--) {
                        const checkStudents = await this.getStudentsByIds(anSession, checkId.toString());
                        if (checkStudents.length === 0) emptyCount++;
                        else {
                            lowestValid = checkId;
                            emptyCount = 0;
                            break;
                        }
                    }
                    if (emptyCount >= 3) break;
                }
                await new Promise(r => setTimeout(r, CONFIG.BINARY_SEARCH_DELAY_MS));
            }

            if (onStatus) onStatus(`Premier ID trouve: ${lowestValid}`);
            return lowestValid;
        }

        /**
         * Enumerate IDGroupe values for a given AnSession
         */
        async enumerateGroups(anSession, startId = 1, callbacks = {}, signal = null) {
            const { onProgress, onFound, onComplete } = callbacks;
            const foundGroups = [];
            let consecutiveMisses = 0;
            let currentId = startId;
            let checked = 0;

            while (consecutiveMisses < CONFIG.MAX_CONSECUTIVE_MISSES) {
                if (signal?.aborted) {
                    if (onComplete) onComplete(foundGroups, true);
                    return foundGroups;
                }

                try {
                    const students = await this.getStudentsByIds(anSession, currentId.toString());
                    checked++;

                    if (onProgress) {
                        onProgress({ currentId, checked, found: foundGroups.length, consecutiveMisses });
                    }

                    if (students.length > 0) {
                        const group = { idGroupe: currentId, anSession, studentCount: students.length, students };
                        foundGroups.push(group);
                        consecutiveMisses = 0;
                        if (onFound) onFound(group);
                    } else {
                        consecutiveMisses++;
                    }
                } catch {
                    consecutiveMisses++;
                    checked++;
                }

                currentId++;
                await new Promise(r => setTimeout(r, CONFIG.REQUEST_DELAY_MS));
            }

            if (onComplete) onComplete(foundGroups, false);
            return foundGroups;
        }
    }

    /**
     * Service for session-based course search
     */
    class SessionSearchService extends BaseService {
        constructor() {
            super();
            this.viewState = document.querySelector('#__VIEWSTATE')?.value || '';
            this.viewStateGenerator = document.querySelector('#__VIEWSTATEGENERATOR')?.value || '';
            this.eventValidation = document.querySelector('#__EVENTVALIDATION')?.value || '';

            const form = document.querySelector('#form1');
            const oidMatch = form?.action?.match(/OidCreateur=([a-zA-Z0-9-]+)/);
            this.oidCreator = oidMatch ? oidMatch[1] : null;
        }

        async searchBySession(sessionValue) {
            if (!this.oidCreator) throw new Error('Donnees de formulaire manquantes');

            const url = `https://${this.subdomain}.omnivox.ca/WebApplication/Commun.SelectionIndividu/Prive/?eModeRecherche=MessagerieInterneOmnivox&OidCreateur=${this.oidCreator}&IdRechercheIndividu=-1&strChampHiddenRecherche=ctl00_cntFormulaire_hidIdRechercheIndividu&AnSession=${sessionValue}`;

            const requestBody = {
                'uRegroupementCategorieGenerique$ddlAnneeSession': sessionValue,
                ScriptManager1: 'updPanel|uListeCategorie$lnk0',
                __EVENTTARGET: 'uListeCategorie$lnk0',
                __EVENTARGUMENT: '',
                __VIEWSTATE: this.viewState,
                __VIEWSTATEGENERATOR: this.viewStateGenerator,
                __VIEWSTATEENCRYPTED: '',
                __EVENTVALIDATION: this.eventValidation,
                hidListeErreursJSON: '',
                __ASYNCPOST: true,
                ':': ''
            };

            const formBody = Object.entries(requestBody)
                .map(([key, value]) => encodeURIComponent(key) + '=' + encodeURIComponent(value))
                .join('&');

            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Accept': '*/*',
                        'Content-Type': 'application/x-www-form-urlencoded; charset=iso-8859-1',
                        'X-MicrosoftAjax': 'Delta=true',
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    body: formBody
                });

                if (!response.ok) throw new Error(`HTTP ${response.status}`);

                const text = await this.decodeIsoResponse(response);
                const match = text.match(/var\s+cours\s*=\s*(\[\{.*?}]);/s);

                if (match) {
                    Utils.setErrorMessage('');
                    return JSON.parse(match[1]).map(item => new Course(item));
                } else {
                    Utils.setErrorMessage('Aucun cours trouve pour cette session');
                    return [];
                }
            } catch {
                Utils.setErrorMessage('Erreur lors de la recuperation des cours');
                return [];
            }
        }
    }

    // ============================================================================
    // COMPONENTS
    // ============================================================================

    /**
     * Handles CSS injection
     */
    const StyleLoader = {
        inject() {
            if (document.getElementById('ovxps-styles')) return;
            const style = document.createElement('style');
            style.id = 'ovxps-styles';
            style.textContent = CSS_STYLES;
            document.head.appendChild(style);
        }
    };

    /**
     * Handles photo preview modal
     */
    const PhotoPreview = {
        show(imgElement) {
            const overlay = document.createElement('div');
            overlay.style.cssText = `
                position: fixed; inset: 0; background: var(--ovxps-overlay);
                backdrop-filter: blur(4px); z-index: 10002; display: flex;
                align-items: center; justify-content: center; cursor: pointer;
            `;

            const previewImg = document.createElement('img');
            previewImg.src = imgElement.src;
            previewImg.alt = imgElement.alt;
            previewImg.style.cssText = `
                max-width: 90vw; max-height: 90vh; object-fit: contain;
                border-radius: var(--ovxps-radius-md); box-shadow: var(--ovxps-shadow);
                transform: scale(0.95); opacity: 0; animation: ovxps-modal-in 0.3s forwards;
            `;

            const closeBtn = document.createElement('button');
            closeBtn.innerHTML = ICONS.close;
            closeBtn.style.cssText = `
                position: absolute; top: 20px; right: 20px; width: 40px; height: 40px;
                border-radius: 50%; background: var(--ovxps-bg); color: var(--ovxps-muted);
                border: none; cursor: pointer; display: flex; align-items: center;
                justify-content: center; box-shadow: var(--ovxps-shadow);
            `;
            closeBtn.onclick = () => overlay.remove();

            overlay.appendChild(previewImg);
            overlay.appendChild(closeBtn);
            document.body.appendChild(overlay);

            overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
        }
    };

    // ============================================================================
    // MAIN APPLICATION CLASS
    // ============================================================================

    /**
     * Main application controller
     */
    class PhotoSearchApp {
        constructor() {
            this.modal = null;
            this.results = null;
            this.currentMode = 'name';
            this.isInitialized = false;
            this.enumerationAbortController = null;
            this.enumeratedGroups = [];
            this.highlightedStudents = [];
            this.currentSearchResults = [];
            this.courseStudentsCache = new Map();
            this.currentCourses = null;
        }

        // --------------------------------
        // Initialization
        // --------------------------------

        async init() {
            if (this.isInitialized) return;
            StyleLoader.inject();
            this.createSearchButton();
            this.setupGlobalFunctions();
            this.isInitialized = true;
        }

        setupGlobalFunctions() {
            window.previewPhoto = (img) => PhotoPreview.show(img);
            window.photoSearchInstance = this;
        }

        createSearchButton() {
            if (document.getElementById('photo-search-button')) return;
            const button = document.createElement('button');
            button.id = 'photo-search-button';
            button.className = 'ovxps-btn';
            button.innerHTML = TEMPLATES.searchButton;
            button.onclick = () => this.openModal();
            document.body.appendChild(button);
        }

        // --------------------------------
        // Modal Management
        // --------------------------------

        async openModal() {
            if (this.modal) return;
            await this.createModal();
            this.bindModalEvents();
            this.results.innerHTML = TEMPLATES.welcome;
            this.loadSessions();
            this.currentMode = 'name';
            this.modal.querySelector('#name-field').style.display = 'block';
            this.hideFilter();
        }

        async createModal() {
            const overlay = document.createElement('div');
            overlay.id = 'photo-search-overlay';
            overlay.setAttribute('aria-hidden', 'false');
            overlay.innerHTML = TEMPLATES.modal;
            document.body.appendChild(overlay);
            this.modal = overlay;
            this.results = overlay.querySelector('#results');
        }

        closeModal() {
            if (this.enumerationAbortController) {
                this.enumerationAbortController.abort();
                this.enumerationAbortController = null;
            }
            this.enumeratedGroups = [];
            this.currentSearchResults = [];
            this.courseStudentsCache = new Map();
            this.currentCourses = null;
            this.highlightedStudents = [];

            if (this.modal) {
                this.modal.remove();
                this.modal = null;
                this.results = null;
            }
        }

        // --------------------------------
        // Event Binding
        // --------------------------------

        bindModalEvents() {
            this.modal.querySelector('.ovxps-close').onclick = () => this.closeModal();
            this.modal.onclick = e => { if (e.target === this.modal) this.closeModal(); };

            document.addEventListener('keydown', e => {
                if (e.key === 'Escape' && this.modal) this.closeModal();
            });

            // Mode buttons
            this.modal.querySelectorAll('.ovxps-mode-btn').forEach(btn => {
                btn.onclick = () => {
                    if (btn.dataset.mode !== this.currentMode) this.switchMode(btn.dataset.mode);
                };
            });

            // Search
            this.modal.querySelector('#search-btn').onclick = () => this.performSearch().catch(() => {
                Utils.setErrorMessage('Une erreur est survenue lors de la recherche');
            });

            this.modal.querySelector('#student-name').onkeydown = e => {
                if (e.key === 'Enter' && this.currentMode === 'name') this.performSearch();
            };

            // Filter
            let filterTimeout = null;
            this.modal.querySelector('#filter-input').oninput = (e) => {
                clearTimeout(filterTimeout);
                filterTimeout = setTimeout(() => {
                    if (this.enumeratedGroups.length > 0) {
                        this.filterEnumeratedResults(e.target.value.trim());
                    }
                }, 300);
            };

            // Clear highlights button
            this.modal.querySelector('#clear-highlights-btn').onclick = () => this.clearHighlights();

            // Escape key to clear highlights
            this.modal.onkeydown = (e) => {
                if (e.key === 'Escape' && this.highlightedStudents?.length > 0) {
                    this.clearHighlights();
                }
            };

            // Export buttons
            this.modal.querySelector('#export-csv-btn').onclick = () => this.exportCSV();
            this.modal.querySelector('#export-json-btn').onclick = () => this.exportJSON();
            this.modal.querySelector('#download-photos-btn').onclick = () => this.downloadAllPhotos();

            // Session save/load
            this.modal.querySelector('#save-session-btn').onclick = () => this.saveSession();
            this.modal.querySelector('#load-session-btn').onclick = () => {
                this.modal.querySelector('#load-session-input').click();
            };
            this.modal.querySelector('#load-session-input').onchange = (e) => this.loadSession(e);
            this.modal.querySelector('#load-session-btn-main').onclick = () => {
                this.modal.querySelector('#load-session-input-main').click();
            };
            this.modal.querySelector('#load-session-input-main').onchange = (e) => this.loadSession(e);

        }

        // --------------------------------
        // Mode Switching
        // --------------------------------

        async switchMode(mode) {
            if (this.currentMode === mode) return;

            if (this.enumerationAbortController) {
                this.enumerationAbortController.abort();
                this.enumerationAbortController = null;
            }

            this.currentMode = mode;
            this.modal.querySelectorAll('.ovxps-mode-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.mode === mode);
            });

            const fields = {
                nameField: this.modal.querySelector('#name-field'),
                sessionField: this.modal.querySelector('#session-field'),
                idFields: this.modal.querySelector('#id-fields'),
                statsSection: this.modal.querySelector('#stats-section'),
                loadSessionBtn: this.modal.querySelector('#load-session-btn-main')
            };

            // Hide all
            fields.nameField.style.display = 'none';
            fields.sessionField.style.display = 'none';
            fields.idFields.style.display = 'none';
            if (fields.statsSection) fields.statsSection.style.display = 'none';

            this.modal.querySelector('#filter-input').value = '';

            if (mode === 'name') {
                fields.nameField.style.display = 'block';
                fields.loadSessionBtn.style.display = 'none';
                this.hideFilter();
                setTimeout(() => this.modal.querySelector('#student-name').focus(), 100);
            } else if (mode === 'session') {
                fields.sessionField.style.display = 'block';
                fields.loadSessionBtn.style.display = 'none';
                this.hideFilter();
                setTimeout(() => this.modal.querySelector('#session-select').focus(), 100);
            } else if (mode === 'id') {
                fields.idFields.style.display = 'block';
                fields.loadSessionBtn.style.display = 'flex';
                this.showFilter();
                setTimeout(() => this.modal.querySelector('#enum-session-select')?.focus(), 100);
            }

            Utils.setErrorMessage('');
            this.results.innerHTML = TEMPLATES.welcome;
            this.currentCourses = null;
            this.enumeratedGroups = [];
            this.courseStudentsCache = new Map();
            this.currentSearchResults = [];
            this.highlightedStudents = [];
            this.hideExportSection();
        }

        loadSessions() {
            const semesters = new Semesters();
            const sessionsHtml = semesters.sessions.map(s => TEMPLATES.sessionOption(s)).join('');
            const defaultOption = '<option value="">Choisir une session...</option>';

            ['#session-select', '#enum-session-select'].forEach(sel => {
                const el = this.modal.querySelector(sel);
                if (el) el.innerHTML = defaultOption + sessionsHtml;
            });
        }

        // --------------------------------
        // Search Functions
        // --------------------------------

        async performSearch() {
            const searchBtn = this.modal.querySelector('#search-btn');
            const originalText = searchBtn.innerHTML;

            try {
                searchBtn.innerHTML = 'Recherche...';
                searchBtn.disabled = true;
                this.results.innerHTML = TEMPLATES.loading;
                Utils.setErrorMessage('');

                if (this.currentMode === 'name') await this.searchByName();
                else if (this.currentMode === 'session') await this.searchBySession();
                else if (this.currentMode === 'id') await this.searchByIds();
            } catch (error) {
                console.error('Search error:', error);
                Utils.setErrorMessage('Une erreur est survenue lors de la recherche');
                this.results.innerHTML = TEMPLATES.welcome;
            } finally {
                searchBtn.innerHTML = originalText;
                searchBtn.disabled = false;
            }
        }

        async searchByName() {
            const name = this.modal.querySelector('#student-name').value.trim();
            if (!name) {
                Utils.setErrorMessage('Veuillez entrer un nom');
                this.results.innerHTML = TEMPLATES.welcome;
                return;
            }

            const students = await new StudentSearchService().search(name);
            if (students.length === 0) {
                this.results.innerHTML = TEMPLATES.noResults;
                return;
            }
            this.displayStudents(students);
        }

        async searchBySession() {
            const sessionValue = this.modal.querySelector('#session-select').value;
            if (!sessionValue) {
                Utils.setErrorMessage('Veuillez choisir une session');
                this.results.innerHTML = TEMPLATES.welcome;
                return;
            }

            const courses = await new SessionSearchService().searchBySession(sessionValue);
            if (courses.length === 0) {
                this.results.innerHTML = TEMPLATES.noResults;
                return;
            }
            this.displayCourses(courses);
        }

        async searchByIds() {
            const sessionValue = this.modal.querySelector('#enum-session-select')?.value;
            if (!sessionValue) {
                Utils.setErrorMessage('Veuillez choisir une session');
                this.results.innerHTML = TEMPLATES.welcome;
                return;
            }

            const directService = new DirectCourseService();

            this.results.innerHTML = `
                <div class="ovxps-loading">
                    ${ICONS.spinner}
                    <p class="ovxps-loading-text" id="detect-status">Detection du premier ID...</p>
                </div>
            `;

            const statsSection = this.modal.querySelector('#stats-section');
            const statCurrentId = this.modal.querySelector('#stat-current-id');
            if (statsSection) statsSection.style.display = 'block';

            const onStatus = (status) => {
                const statusEl = this.results.querySelector('#detect-status');
                if (statusEl) statusEl.textContent = status;
                const match = status.match(/ID (\d+)/);
                if (match && statCurrentId) statCurrentId.textContent = match[1];
            };

            try {
                const startId = await directService.findLowestIdGroupe(sessionValue, onStatus);
                if (startId === null) {
                    Utils.setErrorMessage('Aucun ID valide trouve pour cette session');
                    this.results.innerHTML = TEMPLATES.noResults;
                    return;
                }
                await this.enumerateClasses(directService, sessionValue, startId);
            } catch (error) {
                console.error('Error finding lowest ID:', error);
                Utils.setErrorMessage('Erreur lors de la detection automatique');
                this.results.innerHTML = TEMPLATES.welcome;
            }
        }

        // --------------------------------
        // Enumeration
        // --------------------------------

        async enumerateClasses(directService, anSession, startId) {
            if (this.enumerationAbortController) this.enumerationAbortController.abort();
            this.enumerationAbortController = new AbortController();
            this.enumeratedGroups = [];

            this.results.innerHTML = TEMPLATES.enumerationProgress();

            const statsSection = this.modal.querySelector('#stats-section');
            const stopBtn = this.modal.querySelector('#enum-stop-btn');
            const statClasses = this.modal.querySelector('#stat-classes');
            const statCurrentId = this.modal.querySelector('#stat-current-id');
            const progressFill = this.modal.querySelector('#progress-fill');

            if (statsSection) statsSection.style.display = 'block';
            if (stopBtn) {
                stopBtn.disabled = false;
                stopBtn.textContent = 'Arreter';
                stopBtn.onclick = () => {
                    this.enumerationAbortController.abort();
                    stopBtn.textContent = 'Arret...';
                    stopBtn.disabled = true;
                };
            }

            const enumResults = this.results.querySelector('#enum-results');

            const callbacks = {
                onProgress: (data) => {
                    if (statCurrentId) statCurrentId.textContent = data.currentId;
                    if (statClasses) statClasses.textContent = data.found;
                    const progressPercent = Math.min(95, (data.consecutiveMisses / CONFIG.MAX_CONSECUTIVE_MISSES) * 100);
                    if (progressFill && data.found > 0) progressFill.style.width = `${progressPercent}%`;
                },

                onFound: (group) => {
                    this.enumeratedGroups.push(group);
                    if (statClasses) statClasses.textContent = this.enumeratedGroups.length;

                    const studentsHtml = Utils.generateStudentsHtml(group.students);
                    enumResults.insertAdjacentHTML('beforeend', TEMPLATES.enumeratedClass({
                        idGroupe: group.idGroupe,
                        anSession: group.anSession,
                        studentCount: group.studentCount,
                        studentsHtml
                    }));

                    this.bindEnumeratedClassEvents(enumResults.lastElementChild);

                    if (this.enumeratedGroups.length === 1) this.showExportSection();

                    const filterInput = this.modal.querySelector('#filter-input');
                    if (filterInput?.value.trim()) this.filterEnumeratedResults(filterInput.value.trim());
                },

                onComplete: (groups, wasAborted) => {
                    if (stopBtn) {
                        stopBtn.textContent = wasAborted ? 'Arrete' : 'Termine';
                        stopBtn.disabled = true;
                    }
                    if (progressFill) progressFill.style.width = '100%';
                    if (groups.length > 0) this.showExportSection();
                }
            };

            await directService.enumerateGroups(anSession, startId, callbacks, this.enumerationAbortController.signal);
        }

        filterEnumeratedResults(query) {
            let filterResultsContainer = this.results.querySelector('#filter-results');
            if (!filterResultsContainer) {
                this.results.insertAdjacentHTML('afterbegin', '<div id="filter-results" style="display:none;"></div>');
                filterResultsContainer = this.results.querySelector('#filter-results');
            }

            if (!query || query.length < CONFIG.MIN_FILTER_QUERY_LENGTH) {
                filterResultsContainer.style.display = 'none';
                filterResultsContainer.innerHTML = '';
                this.results.querySelectorAll('.ovxps-course-section').forEach(section => {
                    section.style.display = 'block';
                    section.style.opacity = '1';
                });
                return;
            }

            const queryLower = query.toLowerCase();
            const queryWords = queryLower.split(/\s+/).filter(w => w.length > 0);
            const studentMap = new Map();

            for (const group of this.enumeratedGroups) {
                for (const student of group.students) {
                    const nameLower = student.nom.toLowerCase();

                    // Check if all query words are present in the name
                    const allWordsMatch = queryWords.every(word => nameLower.includes(word));
                    const nodaMatch = student.imageLink.toLowerCase().includes(queryLower);

                    if (allWordsMatch || nodaMatch) {
                        const key = student.nom.toLowerCase().trim();
                        if (!studentMap.has(key)) {
                            // Calculate match score for sorting
                            const exactMatch = nameLower === queryLower ? 100 : 0;
                            const startsWithBonus = nameLower.startsWith(queryLower) ? 50 : 0;
                            const wordMatchCount = queryWords.filter(w => nameLower.includes(w)).length;
                            const score = exactMatch + startsWithBonus + (wordMatchCount * 10);

                            studentMap.set(key, { student, classes: [], nodaList: new Set(), score });
                        }
                        const entry = studentMap.get(key);
                        entry.nodaList.add(student.imageLink);
                        if (!entry.classes.some(c => c.idGroupe === group.idGroupe)) {
                            entry.classes.push({ idGroupe: group.idGroupe, anSession: group.anSession, studentCount: group.studentCount });
                        }
                    }
                }
            }

            if (studentMap.size === 0) {
                filterResultsContainer.innerHTML = `<div class="ovxps-filter-results"><div style="color: var(--ovxps-muted); text-align: center; padding: 16px;">Aucun etudiant trouve pour "${Utils.escapeHtml(query)}"</div></div>`;
                filterResultsContainer.style.display = 'block';
                return;
            }

            const students = Array.from(studentMap.values()).map(entry => {
                const cardData = Utils.generateStudentCardData(entry.student);
                return {
                    displayName: cardData.displayName,
                    avatarUrl: cardData.avatarUrl,
                    photoUrl: cardData.photoUrl,
                    name: entry.student.nom,
                    noda: entry.student.imageLink,
                    classes: entry.classes,
                    score: entry.score
                };
            }).sort((a, b) => b.score - a.score || b.classes.length - a.classes.length || a.displayName.localeCompare(b.displayName));

            filterResultsContainer.innerHTML = TEMPLATES.filterResults({ query, students });
            filterResultsContainer.style.display = 'block';

            // Bind click events
            filterResultsContainer.querySelectorAll('.ovxps-filter-class-tag').forEach(tag => {
                tag.onclick = () => {
                    const section = this.results.querySelector(`.ovxps-course-section[data-idgroupe="${tag.dataset.idgroupe}"]`);
                    if (section) {
                        section.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        const header = section.querySelector('.ovxps-course-header');
                        const content = section.querySelector('.ovxps-course-content');
                        header.setAttribute('aria-expanded', 'true');
                        content.style.display = 'block';
                        this.bindPhotoEvents(content);
                        section.style.boxShadow = '0 0 0 3px var(--ovxps-primary)';
                        setTimeout(() => section.style.boxShadow = '', 2000);
                    }
                };
            });

            // Load photos
            filterResultsContainer.querySelectorAll('.ovxps-filter-student-photo').forEach(img => {
                if (img.dataset.photoUrl) this.loadImageFromUrl(img, img.dataset.photoUrl);
            });

            // Add right-click context menu to filter students
            filterResultsContainer.querySelectorAll('.ovxps-filter-student').forEach(el => {
                el.oncontextmenu = (e) => {
                    this.showContextMenu(e, {
                        name: el.dataset.name,
                        noda: el.dataset.noda,
                        photoUrl: el.dataset.photoUrl
                    });
                };
            });

            // Highlight matching sections
            const matchingIds = new Set([...studentMap.values()].flatMap(e => e.classes.map(c => c.idGroupe.toString())));
            this.results.querySelectorAll('.ovxps-course-section').forEach(section => {
                section.style.opacity = matchingIds.has(section.dataset.idgroupe) ? '1' : '0.4';
            });
        }

        // --------------------------------
        // Display Functions
        // --------------------------------

        displayStudents(students) {
            if (students.length === 0) {
                this.results.innerHTML = TEMPLATES.noResults;
                return;
            }
            this.results.innerHTML = `<div class="ovxps-grid">${Utils.generateStudentsHtml(students)}</div>`;
            this.bindCardEvents();
        }

        displayCourses(courses) {
            if (courses.length === 0) {
                this.results.innerHTML = TEMPLATES.noResults;
                return;
            }

            this.currentCourses = courses;
            this.courseStudentsCache = new Map();

            this.results.innerHTML = courses.map(course => {
                const tagData = Utils.parseTagDataSource(course.getTagDataSource());
                return TEMPLATES.courseSection({
                    courseId: course.getCourseId(),
                    courseTitle: course.getCourseTitle(),
                    count: course.getStudentCount(),
                    anSession: tagData?.anSession || '',
                    idGroupe: tagData?.idGroupe || ''
                });
            }).join('');

            this.bindCourseEvents();
        }

        bindCardEvents() {
            this.bindPhotoEvents(this.results);
        }

        bindCourseEvents() {
            this.results.querySelectorAll('.ovxps-course-section').forEach(section => {
                const header = section.querySelector('.ovxps-course-header');
                const idSpan = section.querySelector('.ovxps-course-ids');
                const courseId = section.dataset.courseId;

                header.onclick = (e) => {
                    if (!e.target.classList.contains('ovxps-course-ids')) {
                        this.toggleCourse(courseId);
                    }
                };

                header.oncontextmenu = (e) => {
                    const cachedData = this.courseStudentsCache.get(courseId);
                    if (cachedData) {
                        const tagData = Utils.parseTagDataSource(cachedData.course.getTagDataSource());
                        this.showClassContextMenu(e, {
                            idGroupe: tagData?.idGroupe || courseId,
                            anSession: tagData?.anSession || '',
                            courseId,
                            students: cachedData.students
                        });
                    } else {
                        e.preventDefault();
                        Utils.showToast('Ouvrez d\'abord la classe pour acceder aux options');
                    }
                };

                if (idSpan) {
                    idSpan.onclick = (e) => {
                        e.stopPropagation();
                        Utils.copyToClipboard(idSpan.textContent);
                    };
                }
            });
        }

        bindEnumeratedClassEvents(section) {
            const header = section.querySelector('.ovxps-course-header');
            const content = section.querySelector('.ovxps-course-content');
            const idSpan = section.querySelector('.ovxps-course-ids');
            const idGroupe = section.dataset.idgroupe;

            header.onclick = (e) => {
                if (e.target.classList.contains('ovxps-course-ids')) {
                    Utils.copyToClipboard(e.target.textContent);
                    e.stopPropagation();
                    return;
                }
                const isExpanded = header.getAttribute('aria-expanded') === 'true';
                header.setAttribute('aria-expanded', !isExpanded);
                content.style.display = isExpanded ? 'none' : 'block';
                if (!isExpanded) {
                    this.bindPhotoEvents(content);
                    this.applyHighlightsToContainer(content);
                }
            };

            header.oncontextmenu = (e) => {
                const group = this.enumeratedGroups.find(g => g.idGroupe.toString() === idGroupe);
                if (group) this.showClassContextMenu(e, { idGroupe: group.idGroupe, anSession: group.anSession, students: group.students });
            };

            if (idSpan) {
                idSpan.onclick = (e) => {
                    e.stopPropagation();
                    Utils.copyToClipboard(idSpan.textContent);
                };
            }
        }

        // --------------------------------
        // Photo Loading
        // --------------------------------

        bindPhotoEvents(container) {
            const images = container.querySelectorAll('.ovxps-photo');

            images.forEach(img => {
                if (img.dataset.loaded === 'true' || img.dataset.loading === 'true') {
                    this.setupPhotoClickHandlers(img);
                    return;
                }

                const observer = new IntersectionObserver((entries) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            this.loadStudentPhoto(entry.target);
                            observer.unobserve(entry.target);
                        }
                    });
                }, { root: this.results, rootMargin: '100px' });

                observer.observe(img);
                this.setupPhotoClickHandlers(img);
            });

            // Force load first batch
            setTimeout(() => {
                let loadedCount = 0;
                images.forEach(img => {
                    if (loadedCount >= CONFIG.INITIAL_PHOTOS_TO_LOAD) return;
                    if (img.dataset.loading !== 'true' && img.dataset.loaded !== 'true') {
                        this.loadStudentPhoto(img);
                        loadedCount++;
                    }
                });
            }, CONFIG.PHOTO_LOAD_DELAY_MS);
        }

        setupPhotoClickHandlers(img) {
            img.onclick = (e) => {
                if (e.shiftKey && (this.enumeratedGroups.length > 0 || this.courseStudentsCache.size > 0)) {
                    if (img.dataset.name) this.highlightStudents([img.dataset.name]);
                } else {
                    PhotoPreview.show(img);
                }
            };

            img.oncontextmenu = (e) => {
                this.showContextMenu(e, { name: img.dataset.name, noda: img.dataset.noda, photoUrl: img.dataset.photoUrl });
            };
        }

        async toggleCourse(courseId) {
            const section = this.results.querySelector(`[data-course-id="${courseId}"]`);
            if (!section) return;

            const header = section.querySelector('.ovxps-course-header');
            const content = section.querySelector('.ovxps-course-content');
            const isExpanded = header.getAttribute('aria-expanded') === 'true';

            if (isExpanded) {
                header.setAttribute('aria-expanded', 'false');
                content.style.display = 'none';
                return;
            }

            header.setAttribute('aria-expanded', 'true');
            content.style.display = 'block';

            const course = this.currentCourses?.find(c => c.getCourseId() === courseId);
            if (!course) {
                content.innerHTML = TEMPLATES.noResults;
                return;
            }

            if (content.querySelector('.ovxps-grid')) {
                this.bindPhotoEvents(content);
                this.applyHighlightsToContainer(content);
                return;
            }

            content.innerHTML = TEMPLATES.loading;

            try {
                const students = await course.getStudents();
                if (students.length === 0) {
                    content.innerHTML = TEMPLATES.noResults;
                    return;
                }

                this.courseStudentsCache.set(courseId, { course, students });
                content.innerHTML = `<div class="ovxps-grid">${Utils.generateStudentsHtml(students)}</div>`;
                this.bindPhotoEvents(content);
                this.applyHighlightsToContainer(content);
            } catch {
                content.innerHTML = TEMPLATES.noResults;
            }
        }

        async loadImageFromUrl(img, url) {
            try {
                const response = await fetch(url);
                if (response.status === 200) {
                    const blob = await response.blob();
                    if (blob.size > 0 && blob.type.startsWith('image/')) {
                        const objectUrl = URL.createObjectURL(blob);
                        img.src = objectUrl;
                        img.onload = () => URL.revokeObjectURL(objectUrl);
                        return true;
                    }
                }
                return false;
            } catch {
                return false;
            }
        }

        async loadStudentPhoto(img) {
            const photoUrl = img.dataset.photoUrl;
            const fallbackUrl = img.dataset.fallbackUrl;
            if (!photoUrl || img.dataset.loading === 'true' || img.dataset.loaded === 'true') return;

            img.dataset.loading = 'true';

            try {
                if (await this.loadImageFromUrl(img, photoUrl)) {
                    img.dataset.loaded = 'true';
                } else if (fallbackUrl && await this.loadImageFromUrl(img, fallbackUrl)) {
                    img.dataset.loaded = 'true';
                }
            } finally {
                img.dataset.loading = 'false';
            }
        }

        // --------------------------------
        // Export Functionality
        // --------------------------------

        async getAllGroups() {
            if (this.enumeratedGroups.length > 0) return this.enumeratedGroups;

            if (this.currentCourses && this.courseStudentsCache.size > 0) {
                const groups = [];
                for (const [courseId, data] of this.courseStudentsCache) {
                    const tagData = Utils.parseTagDataSource(data.course.getTagDataSource());
                    groups.push({
                        idGroupe: tagData?.idGroupe || courseId,
                        anSession: tagData?.anSession || '',
                        studentCount: data.students.length,
                        students: data.students,
                        courseTitle: data.course.getCourseTitle()
                    });
                }
                return groups;
            }
            return [];
        }

        async loadAllCourseStudents() {
            if (!this.currentCourses?.length) return false;
            Utils.showToast('Chargement de tous les etudiants...');

            for (const course of this.currentCourses) {
                const courseId = course.getCourseId();
                if (!this.courseStudentsCache.has(courseId)) {
                    try {
                        const students = await course.getStudents();
                        this.courseStudentsCache.set(courseId, { course, students });
                    } catch (error) {
                        console.error('Error loading students:', courseId, error);
                    }
                }
            }
            return true;
        }

        async exportCSV() {
            let groups = await this.getAllGroups();
            if (groups.length === 0 && this.currentCourses?.length > 0) {
                await this.loadAllCourseStudents();
                groups = await this.getAllGroups();
            }
            if (groups.length === 0) {
                Utils.showToast('Aucune donnee a exporter');
                return;
            }

            const csv = Utils.exportToCSV(groups);
            const filename = `omnivox_export_${new Date().toISOString().slice(0, 10)}.csv`;
            Utils.downloadFile(csv, filename, 'text/csv;charset=utf-8;');
            Utils.showToast(`Export CSV: ${filename}`);
        }

        async exportJSON() {
            let groups = await this.getAllGroups();
            if (groups.length === 0 && this.currentCourses?.length > 0) {
                await this.loadAllCourseStudents();
                groups = await this.getAllGroups();
            }
            if (groups.length === 0) {
                Utils.showToast('Aucune donnee a exporter');
                return;
            }

            const json = Utils.exportToJSON(groups);
            const filename = `omnivox_export_${new Date().toISOString().slice(0, 10)}.json`;
            Utils.downloadFile(json, filename, 'application/json');
            Utils.showToast(`Export JSON: ${filename}`);
        }

        // --------------------------------
        // Session Save/Load
        // --------------------------------

        async saveSession() {
            const groups = await this.getAllGroups();
            if (groups.length === 0) {
                Utils.showToast('Aucune donnee a sauvegarder');
                return;
            }

            const sessionData = {
                version: 1,
                savedAt: new Date().toISOString(),
                mode: this.currentMode,
                enumeratedGroups: groups.map(g => ({
                    idGroupe: g.idGroupe,
                    anSession: g.anSession,
                    studentCount: g.studentCount,
                    courseTitle: g.courseTitle || null,
                    students: g.students.map(s => ({ nom: s.nom, imageLink: s.imageLink, programme: s.programme || null }))
                })),
                highlightedStudents: this.highlightedStudents || []
            };

            const filename = `omnivox_session_${groups[0]?.anSession || 'session'}_${new Date().toISOString().slice(0, 10)}.json`;
            Utils.downloadFile(JSON.stringify(sessionData), filename, 'application/json');
            Utils.showToast(`Session sauvegardee: ${filename}`);
        }

        loadSession(event) {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const sessionData = JSON.parse(e.target.result);
                    if (!sessionData.enumeratedGroups || !Array.isArray(sessionData.enumeratedGroups)) {
                        Utils.showToast('Fichier de session invalide');
                        return;
                    }

                    this.enumeratedGroups = sessionData.enumeratedGroups.map(g => ({
                        idGroupe: g.idGroupe,
                        anSession: g.anSession,
                        studentCount: g.studentCount || g.students.length,
                        courseTitle: g.courseTitle,
                        students: g.students.map(s => new Student(s.nom, s.imageLink, s.programme))
                    }));

                    this.highlightedStudents = sessionData.highlightedStudents || [];
                    this.currentMode = 'id';
                    this.modal.querySelectorAll('.ovxps-mode-btn').forEach(btn => {
                        btn.classList.toggle('active', btn.dataset.mode === 'id');
                    });

                    this.showFilter();
                    this.modal.querySelector('#name-field').style.display = 'none';
                    this.modal.querySelector('#session-field').style.display = 'none';
                    this.modal.querySelector('#id-fields').style.display = 'none';

                    this.restoreEnumerationResults();
                    this.showExportSection();

                    const statClasses = this.modal.querySelector('#stat-classes');
                    if (statClasses) statClasses.textContent = this.enumeratedGroups.length;

                    const statsSection = this.modal.querySelector('#stats-section');
                    if (statsSection) statsSection.style.display = 'block';

                    const stopBtn = this.modal.querySelector('#enum-stop-btn');
                    if (stopBtn) { stopBtn.textContent = 'Charge'; stopBtn.disabled = true; }

                    Utils.showToast(`Session chargee: ${this.enumeratedGroups.length} classes`);
                } catch (error) {
                    console.error('Error loading session:', error);
                    Utils.showToast('Erreur lors du chargement de la session');
                }
            };

            reader.readAsText(file);
            event.target.value = '';
        }

        async downloadAllPhotos() {
            let groups = await this.getAllGroups();
            if (groups.length === 0 && this.currentCourses?.length > 0) {
                await this.loadAllCourseStudents();
                groups = await this.getAllGroups();
            }
            if (groups.length === 0) {
                Utils.showToast('Aucune photo a telecharger');
                return;
            }

            const btn = this.modal.querySelector('#download-photos-btn');
            const originalHtml = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = ICONS.spinner;

            try {
                const uniqueStudents = new Map();
                for (const group of groups) {
                    for (const student of group.students) {
                        if (!uniqueStudents.has(student.imageLink)) uniqueStudents.set(student.imageLink, student);
                    }
                }

                const subdomain = Utils.getSubdomain(window.location.href);
                let downloaded = 0;
                const total = uniqueStudents.size;

                for (const [noDA, student] of uniqueStudents) {
                    const photoUrl = `https://${subdomain}.omnivox.ca${ENDPOINTS.PHOTO}?NoDA=${noDA}`;
                    try {
                        const response = await fetch(photoUrl);
                        if (response.ok) {
                            const blob = await response.blob();
                            if (blob.size > 100 && blob.type.startsWith('image/')) {
                                const filename = Utils.sanitizeFileName(`${Utils.formatNameClassic(student.nom)}_${noDA}.jpg`);
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = filename;
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                                URL.revokeObjectURL(url);
                                downloaded++;
                            }
                        }
                    } catch (error) {
                        console.error('Error downloading photo:', noDA, error);
                    }
                    btn.textContent = `${downloaded}/${total}`;
                    await new Promise(r => setTimeout(r, CONFIG.REQUEST_DELAY_MS));
                }

                Utils.showToast(`${downloaded} photos telechargees`);
            } finally {
                btn.innerHTML = originalHtml;
                btn.disabled = false;
            }
        }

        restoreEnumerationResults() {
            if (this.currentMode === 'session' && this.currentCourses?.length > 0) {
                this.displayCourses(this.currentCourses);
                return;
            }

            if (this.enumeratedGroups.length === 0) {
                this.results.innerHTML = TEMPLATES.welcome;
                return;
            }

            this.results.innerHTML = TEMPLATES.enumerationProgress();
            const enumResults = this.results.querySelector('#enum-results');

            for (const group of this.enumeratedGroups) {
                enumResults.insertAdjacentHTML('beforeend', TEMPLATES.enumeratedClass({
                    idGroupe: group.idGroupe,
                    anSession: group.anSession,
                    studentCount: group.studentCount,
                    studentsHtml: Utils.generateStudentsHtml(group.students)
                }));
                this.bindEnumeratedClassEvents(enumResults.lastElementChild);
            }

            const filterInput = this.modal.querySelector('#filter-input');
            if (filterInput?.value.trim()) this.filterEnumeratedResults(filterInput.value.trim());
        }

        // --------------------------------
        // Highlighting
        // --------------------------------

        highlightStudents(studentNames) {
            this.highlightedStudents = studentNames.map(n => n.toLowerCase().trim());

            this.results.querySelectorAll('.ovxps-card.highlighted').forEach(card => card.classList.remove('highlighted'));
            this.results.querySelectorAll('.ovxps-course-section').forEach(section => section.style.opacity = '1');

            this.results.querySelectorAll('.ovxps-course-section').forEach(section => {
                const header = section.querySelector('.ovxps-course-header');
                const content = section.querySelector('.ovxps-course-content');

                let hasMatch = false;
                content.querySelectorAll('.ovxps-card').forEach(card => {
                    const img = card.querySelector('.ovxps-photo');
                    const name = img?.dataset.name?.toLowerCase().trim();
                    if (name && this.highlightedStudents.includes(name)) {
                        hasMatch = true;
                        card.classList.add('highlighted');
                    }
                });

                if (hasMatch) {
                    header.setAttribute('aria-expanded', 'true');
                    content.style.display = 'block';
                    this.bindPhotoEvents(content);
                    section.style.opacity = '1';
                } else {
                    section.style.opacity = '0.4';
                }
            });

            const firstHighlighted = this.results.querySelector('.ovxps-card.highlighted');
            if (firstHighlighted) {
                setTimeout(() => firstHighlighted.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
            }

            const formattedNames = studentNames.slice(0, 3).map(n => Utils.formatNameClassic(n));
            Utils.showToast(`Surligne: ${formattedNames.join(', ')}${studentNames.length > 3 ? ` +${studentNames.length - 3}` : ''}`);

            this.showClearHighlightsButton();
        }

        applyHighlightsToContainer(container) {
            if (!this.highlightedStudents?.length) return;

            let hasMatch = false;
            container.querySelectorAll('.ovxps-card').forEach(card => {
                const img = card.querySelector('.ovxps-photo');
                const name = img?.dataset.name?.toLowerCase().trim();
                if (name && this.highlightedStudents.includes(name)) {
                    card.classList.add('highlighted');
                    hasMatch = true;
                }
            });

            const section = container.closest('.ovxps-course-section');
            if (section) section.style.opacity = hasMatch ? '1' : '0.4';
        }

        clearHighlights() {
            this.highlightedStudents = [];
            this.results?.querySelectorAll('.ovxps-card.highlighted').forEach(card => card.classList.remove('highlighted'));
            this.results?.querySelectorAll('.ovxps-course-section').forEach(section => {
                section.style.display = 'block';
                section.style.opacity = '1';
            });
            this.hideClearHighlightsButton();
        }

        showClearHighlightsButton() {
            const btn = this.modal?.querySelector('#clear-highlights-btn');
            const mainHeader = this.modal?.querySelector('.ovxps-main-header');
            const filterInput = this.modal?.querySelector('#filter-input');
            if (btn) btn.style.display = 'flex';
            if (mainHeader) mainHeader.style.display = 'flex';
            // Only show filter input in Tout explorer mode
            if (filterInput && this.currentMode !== 'id') {
                filterInput.style.display = 'none';
            }
        }

        hideClearHighlightsButton() {
            const btn = this.modal?.querySelector('#clear-highlights-btn');
            if (btn) btn.style.display = 'none';
            // Re-hide header if we're not in a mode that shows filter
            if (this.currentMode !== 'id') {
                const mainHeader = this.modal?.querySelector('.ovxps-main-header');
                if (mainHeader) mainHeader.style.display = 'none';
            }
        }

        findAllClassesForStudent(studentName) {
            const nameKey = studentName.toLowerCase().trim();
            const foundGroups = [];

            // Search through all enumerated groups
            for (const group of this.enumeratedGroups) {
                for (const student of group.students) {
                    if (student.nom.toLowerCase().trim() === nameKey) {
                        foundGroups.push({
                            idGroupe: group.idGroupe,
                            anSession: group.anSession,
                            studentCount: group.studentCount
                        });
                        break;
                    }
                }
            }

            if (foundGroups.length === 0) {
                Utils.showToast(`${Utils.formatNameClassic(studentName)} n'est dans aucune classe chargee`);
                return;
            }

            // Show toast with count
            const formattedName = Utils.formatNameClassic(studentName);
            Utils.showToast(`${formattedName} est dans ${foundGroups.length} classe${foundGroups.length > 1 ? 's' : ''}`);

            // Highlight the student and show only their classes
            this.highlightedStudents = [nameKey];
            this.results.querySelectorAll('.ovxps-card.highlighted').forEach(card => card.classList.remove('highlighted'));

            this.results.querySelectorAll('.ovxps-course-section').forEach(section => {
                const idGroupe = section.dataset.idgroupe;
                const isInGroup = foundGroups.some(g => g.idGroupe.toString() === idGroupe);
                const header = section.querySelector('.ovxps-course-header');
                const content = section.querySelector('.ovxps-course-content');

                if (isInGroup) {
                    section.style.display = 'block';
                    section.style.opacity = '1';
                    header.setAttribute('aria-expanded', 'true');
                    content.style.display = 'block';
                    this.bindPhotoEvents(content);

                    // Highlight the student card
                    content.querySelectorAll('.ovxps-card').forEach(card => {
                        const img = card.querySelector('.ovxps-photo');
                        const name = img?.dataset.name?.toLowerCase().trim();
                        if (name === nameKey) {
                            card.classList.add('highlighted');
                        }
                    });
                } else {
                    // Hide non-matching classes entirely
                    section.style.display = 'none';
                }
            });

            // Scroll to first highlighted
            const firstHighlighted = this.results.querySelector('.ovxps-card.highlighted');
            if (firstHighlighted) {
                setTimeout(() => firstHighlighted.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
            }

            this.showClearHighlightsButton();
        }

        // --------------------------------
        // Context Menus
        // --------------------------------

        showContextMenu(e, studentData) {
            e.preventDefault();
            this.hideContextMenu();

            const showFindAllClasses = this.currentMode === 'id' && this.enumeratedGroups.length > 0;

            const menu = document.createElement('div');
            menu.innerHTML = TEMPLATES.contextMenu({
                x: Math.min(e.clientX, window.innerWidth - 180),
                y: Math.min(e.clientY, window.innerHeight - 120),
                showFindAllClasses
            });
            document.body.appendChild(menu.firstElementChild);

            const contextMenu = document.querySelector('.ovxps-context-menu');

            const findAllClassesBtn = contextMenu.querySelector('[data-action="find-all-classes"]');
            if (findAllClassesBtn) {
                findAllClassesBtn.onclick = () => {
                    this.hideContextMenu();
                    if (studentData.name) this.findAllClassesForStudent(studentData.name);
                };
            }

            contextMenu.querySelector('[data-action="detect-program"]').onclick = () => {
                this.hideContextMenu();
                this.detectStudentProgram(studentData);
            };

            contextMenu.querySelector('[data-action="highlight"]').onclick = () => {
                this.hideContextMenu();
                if (studentData.name) this.highlightStudents([studentData.name]);
            };

            contextMenu.querySelector('[data-action="download"]').onclick = () => {
                this.hideContextMenu();
                this.downloadStudentPhoto(studentData);
            };

            setTimeout(() => {
                const closeHandler = (ev) => {
                    if (!contextMenu.contains(ev.target)) {
                        this.hideContextMenu();
                        document.removeEventListener('click', closeHandler);
                    }
                };
                document.addEventListener('click', closeHandler);
            }, 10);
        }

        hideContextMenu() {
            document.querySelector('.ovxps-context-menu')?.remove();
        }

        showClassContextMenu(e, classData) {
            e.preventDefault();
            this.hideContextMenu();

            const menu = document.createElement('div');
            menu.innerHTML = TEMPLATES.classContextMenu({
                x: Math.min(e.clientX, window.innerWidth - 200),
                y: Math.min(e.clientY, window.innerHeight - 140)
            });
            document.body.appendChild(menu.firstElementChild);

            const contextMenu = document.querySelector('.ovxps-context-menu');

            contextMenu.querySelector('[data-action="detect-all-programs"]').onclick = () => {
                this.hideContextMenu();
                this.detectClassPrograms(classData);
            };

            contextMenu.querySelector('[data-action="export-class"]').onclick = () => {
                this.hideContextMenu();
                this.exportSingleClass(classData);
            };

            contextMenu.querySelector('[data-action="download-all-photos"]').onclick = () => {
                this.hideContextMenu();
                this.downloadClassPhotos(classData);
            };

            contextMenu.querySelector('[data-action="download-class-image"]').onclick = () => {
                this.hideContextMenu();
                this.downloadClassAsImage(classData);
            };

            setTimeout(() => {
                const closeHandler = (ev) => {
                    if (!contextMenu.contains(ev.target)) {
                        this.hideContextMenu();
                        document.removeEventListener('click', closeHandler);
                    }
                };
                document.addEventListener('click', closeHandler);
            }, 10);
        }

        // --------------------------------
        // Program Detection
        // --------------------------------

        async detectClassPrograms(classData) {
            if (!classData.students?.length) {
                Utils.showToast('Aucun etudiant dans cette classe');
                return;
            }

            const studentsWithoutProgram = classData.students.filter(s => !s.programme);
            if (studentsWithoutProgram.length === 0) {
                Utils.showToast('Tous les programmes sont deja detectes');
                return;
            }

            Utils.showToast(`Detection des programmes pour ${studentsWithoutProgram.length} etudiants...`);

            const searchService = new StudentSearchService();
            const subdomain = Utils.getSubdomain(window.location.href);
            let detected = 0;

            for (const student of studentsWithoutProgram) {
                try {
                    const results = await searchService.search(student.nom);
                    if (results.length === 0) continue;

                    const studentPhotoUrl = `https://${subdomain}.omnivox.ca${ENDPOINTS.PHOTO}?NoDA=${student.imageLink}`;
                    const studentHash = await Utils.getImageHash(studentPhotoUrl);

                    for (const result of results) {
                        if (!result.programme) continue;

                        const resultName = result.nom.toLowerCase().trim();
                        const studentName = student.nom.toLowerCase().trim();
                        if (resultName !== studentName && !resultName.includes(studentName) && !studentName.includes(resultName)) continue;

                        if (studentHash) {
                            const resultPhotoUrl = `https://${subdomain}.omnivox.ca${ENDPOINTS.PHOTO}?NoDA=${result.imageLink}`;
                            const resultHash = await Utils.getImageHash(resultPhotoUrl);

                            if (resultHash && Utils.hammingDistance(studentHash, resultHash) < studentHash.length * CONFIG.HASH_SIMILARITY_THRESHOLD) {
                                this.updateStudentProgram(student.nom, result.programme);
                                detected++;
                                break;
                            }
                        } else if (resultName === studentName) {
                            this.updateStudentProgram(student.nom, result.programme);
                            detected++;
                            break;
                        }
                    }
                } catch (error) {
                    console.error('Error detecting program for', student.nom, error);
                }

                await new Promise(r => setTimeout(r, 150));
            }

            Utils.showToast(`${detected} programme(s) detecte(s) sur ${studentsWithoutProgram.length}`);
        }

        exportSingleClass(classData) {
            if (!classData.students?.length) {
                Utils.showToast('Aucun etudiant dans cette classe');
                return;
            }

            const groups = [{
                idGroupe: classData.idGroupe || classData.courseId,
                anSession: classData.anSession || '',
                studentCount: classData.students.length,
                students: classData.students
            }];

            const csv = Utils.exportToCSV(groups);
            const filename = `classe_${classData.idGroupe || classData.courseId}_${new Date().toISOString().slice(0, 10)}.csv`;
            Utils.downloadFile(csv, filename, 'text/csv;charset=utf-8;');
            Utils.showToast(`Export: ${filename}`);
        }

        async downloadClassPhotos(classData) {
            if (!classData.students?.length) {
                Utils.showToast('Aucun etudiant dans cette classe');
                return;
            }

            Utils.showToast(`Telechargement de ${classData.students.length} photos...`);

            const subdomain = Utils.getSubdomain(window.location.href);
            let downloaded = 0;

            for (const student of classData.students) {
                const photoUrl = `https://${subdomain}.omnivox.ca${ENDPOINTS.PHOTO}?NoDA=${student.imageLink}`;
                try {
                    const response = await fetch(photoUrl);
                    if (response.ok) {
                        const blob = await response.blob();
                        if (blob.size > 100 && blob.type.startsWith('image/')) {
                            const filename = Utils.sanitizeFileName(`${Utils.formatNameClassic(student.nom)}_${student.imageLink}.jpg`);
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = filename;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            URL.revokeObjectURL(url);
                            downloaded++;
                        }
                    }
                } catch (error) {
                    console.error('Error downloading photo:', student.imageLink, error);
                }
                await new Promise(r => setTimeout(r, CONFIG.REQUEST_DELAY_MS));
            }

            Utils.showToast(`${downloaded} photos telechargees`);
        }

        async downloadClassAsImage(classData) {
            if (!classData.students?.length) {
                Utils.showToast('Aucun etudiant dans cette classe');
                return;
            }

            Utils.showToast('Generation de l\'image...');

            const subdomain = Utils.getSubdomain(window.location.href);
            const students = classData.students;

            // Configuration
            const photoSize = 120;
            const padding = 16;
            const nameHeight = 40;
            const cols = Math.min(6, Math.ceil(Math.sqrt(students.length)));
            const rows = Math.ceil(students.length / cols);
            const cellWidth = photoSize + padding;
            const cellHeight = photoSize + nameHeight + padding;
            const headerHeight = 60;

            const canvasWidth = cols * cellWidth + padding;
            const canvasHeight = rows * cellHeight + headerHeight + padding;

            const canvas = document.createElement('canvas');
            canvas.width = canvasWidth;
            canvas.height = canvasHeight;
            const ctx = canvas.getContext('2d');

            // Background
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);

            // Header
            ctx.fillStyle = '#1e293b';
            ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            const title = classData.courseTitle || `Groupe ${classData.idGroupe}`;
            ctx.fillText(title, padding, 35);

            ctx.fillStyle = '#64748b';
            ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            ctx.fillText(`${students.length} etudiants | ${classData.anSession || ''}:${classData.idGroupe || ''}`, padding, 52);

            // Load all images
            const loadImage = (url) => new Promise((resolve) => {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => resolve(img);
                img.onerror = () => resolve(null);
                img.src = url;
            });

            const images = await Promise.all(students.map(student => {
                const photoUrl = `https://${subdomain}.omnivox.ca${ENDPOINTS.PHOTO}?NoDA=${student.imageLink}`;
                return loadImage(photoUrl);
            }));

            // Draw students
            students.forEach((student, index) => {
                const col = index % cols;
                const row = Math.floor(index / cols);
                const x = padding + col * cellWidth;
                const y = headerHeight + row * cellHeight;

                // Photo background
                ctx.fillStyle = '#f1f5f9';
                ctx.fillRect(x, y, photoSize, photoSize);

                // Photo
                const img = images[index];
                if (img) {
                    const aspectRatio = img.width / img.height;
                    let drawWidth = photoSize;
                    let drawHeight = photoSize;
                    let offsetX = 0;
                    let offsetY = 0;

                    if (aspectRatio > 1) {
                        drawHeight = photoSize / aspectRatio;
                        offsetY = (photoSize - drawHeight) / 2;
                    } else {
                        drawWidth = photoSize * aspectRatio;
                        offsetX = (photoSize - drawWidth) / 2;
                    }

                    ctx.drawImage(img, x + offsetX, y + offsetY, drawWidth, drawHeight);
                } else {
                    // Placeholder with initials
                    ctx.fillStyle = '#94a3b8';
                    ctx.font = 'bold 32px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
                    const initials = student.nom.split(/[,\s]+/).slice(0, 2).map(n => n[0]).join('').toUpperCase();
                    const textWidth = ctx.measureText(initials).width;
                    ctx.fillText(initials, x + (photoSize - textWidth) / 2, y + photoSize / 2 + 10);
                }

                // Name
                ctx.fillStyle = '#1e293b';
                ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
                const displayName = Utils.formatNameClassic(student.nom);
                const truncatedName = displayName.length > 18 ? displayName.substring(0, 16) + '...' : displayName;
                ctx.fillText(truncatedName, x, y + photoSize + 14);

                // Programme if available
                if (student.programme) {
                    ctx.fillStyle = '#64748b';
                    ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
                    const truncatedProg = student.programme.length > 20 ? student.programme.substring(0, 18) + '...' : student.programme;
                    ctx.fillText(truncatedProg, x, y + photoSize + 28);
                }
            });

            // Download
            canvas.toBlob((blob) => {
                const filename = Utils.sanitizeFileName(`classe_${classData.idGroupe || 'export'}_${classData.anSession || ''}.png`);
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                Utils.showToast('Image telechargee');
            }, 'image/png');
        }

        async detectStudentProgram(studentData) {
            if (!studentData.name || !studentData.noda) {
                Utils.showToast('Donnees etudiant manquantes');
                return;
            }

            Utils.showToast(`Recherche du programme pour ${Utils.formatNameClassic(studentData.name)}...`);

            try {
                const results = await new StudentSearchService().search(studentData.name);
                if (results.length === 0) {
                    Utils.showToast('Aucun resultat trouve');
                    return;
                }

                const subdomain = Utils.getSubdomain(window.location.href);
                const studentPhotoUrl = `https://${subdomain}.omnivox.ca${ENDPOINTS.PHOTO}?NoDA=${studentData.noda}`;
                const studentHash = await Utils.getImageHash(studentPhotoUrl);

                if (!studentHash) {
                    const exactMatch = results.find(r => r.nom.toLowerCase().trim() === studentData.name.toLowerCase().trim());
                    if (exactMatch?.programme) {
                        this.updateStudentProgram(studentData.name, exactMatch.programme);
                        Utils.showToast(`Programme: ${exactMatch.programme}`);
                    } else {
                        Utils.showToast('Programme non trouve');
                    }
                    return;
                }

                for (const result of results) {
                    if (!result.programme) continue;

                    const resultName = result.nom.toLowerCase().trim();
                    const studentName = studentData.name.toLowerCase().trim();
                    if (resultName !== studentName && !resultName.includes(studentName) && !studentName.includes(resultName)) continue;

                    const resultPhotoUrl = `https://${subdomain}.omnivox.ca${ENDPOINTS.PHOTO}?NoDA=${result.imageLink}`;
                    const resultHash = await Utils.getImageHash(resultPhotoUrl);

                    if (resultHash && Utils.hammingDistance(studentHash, resultHash) < studentHash.length * CONFIG.HASH_SIMILARITY_THRESHOLD) {
                        this.updateStudentProgram(studentData.name, result.programme);
                        Utils.showToast(`Programme: ${result.programme}`);
                        return;
                    }
                }

                Utils.showToast('Programme non trouve (pas de correspondance photo)');
            } catch (error) {
                console.error('Error detecting program:', error);
                Utils.showToast('Erreur lors de la detection');
            }
        }

        updateStudentProgram(studentName, programme) {
            const nameKey = studentName.toLowerCase().trim();

            for (const group of this.enumeratedGroups) {
                for (const student of group.students) {
                    if (student.nom.toLowerCase().trim() === nameKey) student.programme = programme;
                }
            }

            for (const [, data] of this.courseStudentsCache) {
                for (const student of data.students) {
                    if (student.nom.toLowerCase().trim() === nameKey) student.programme = programme;
                }
            }

            this.results.querySelectorAll('.ovxps-card').forEach(card => {
                const img = card.querySelector('.ovxps-photo');
                if (img?.dataset.name?.toLowerCase().trim() === nameKey) {
                    let programEl = card.querySelector('.ovxps-student-noda');
                    if (programEl) {
                        programEl.textContent = programme;
                    } else {
                        const body = card.querySelector('.ovxps-card-body');
                        if (body) {
                            const p = document.createElement('p');
                            p.className = 'ovxps-student-noda';
                            p.textContent = programme;
                            body.appendChild(p);
                        }
                    }
                }
            });
        }

        async downloadStudentPhoto(studentData) {
            if (!studentData.noda) {
                Utils.showToast('Pas de photo disponible');
                return;
            }

            const subdomain = Utils.getSubdomain(window.location.href);
            const photoUrl = `https://${subdomain}.omnivox.ca${ENDPOINTS.PHOTO}?NoDA=${studentData.noda}`;

            try {
                const response = await fetch(photoUrl);
                if (response.ok) {
                    const blob = await response.blob();
                    if (blob.size > 100 && blob.type.startsWith('image/')) {
                        const filename = Utils.sanitizeFileName(`${Utils.formatNameClassic(studentData.name || 'photo')}_${studentData.noda}.jpg`);
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = filename;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                        Utils.showToast('Photo telechargee');
                        return;
                    }
                }
                Utils.showToast('Erreur lors du telechargement');
            } catch {
                Utils.showToast('Erreur lors du telechargement');
            }
        }

        // --------------------------------
        // Filter Visibility Helpers
        // --------------------------------

        showFilter() {
            const filterInput = this.modal?.querySelector('#filter-input');
            const mainHeader = this.modal?.querySelector('.ovxps-main-header');
            if (filterInput) filterInput.style.display = 'block';
            if (mainHeader) mainHeader.style.display = 'flex';
        }

        hideFilter() {
            const filterInput = this.modal?.querySelector('#filter-input');
            const mainHeader = this.modal?.querySelector('.ovxps-main-header');
            if (filterInput) filterInput.style.display = 'none';
            if (mainHeader) mainHeader.style.display = 'none';
        }

        showExportSection() {
            const exportSection = this.modal.querySelector('#export-section');
            if (exportSection) exportSection.style.display = 'block';
        }

        hideExportSection() {
            const exportSection = this.modal.querySelector('#export-section');
            if (exportSection) exportSection.style.display = 'none';
        }
    }

    // ============================================================================
    // INITIALIZATION
    // ============================================================================
    const app = new PhotoSearchApp();
    app.init();

    // Expose globally for debugging
    window.omnivoxPhotoSearch = app;
})();
