import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';
import Shell from 'gi://Shell';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as AppDisplay from 'resource:///org/gnome/shell/ui/appDisplay.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

export default class DashHoverHoldExtension extends Extension {
    enable() {
        this._monitorId = null;
        this._showingId = null;
        this._hiddenId = null;
        this._wasInDash = false; 
        
        const ext = this;

        // 1. Intercept the app icon click
        this._originalAppIconActivate = AppDisplay.AppIcon.prototype.activate;

        AppDisplay.AppIcon.prototype.activate = function (button) {
            let event = Clutter.get_current_event();
            let modifiers = event ? event.get_state() : 0;
            let isMiddleButton = button && button === Clutter.BUTTON_MIDDLE;
            let isCtrlPressed = (modifiers & Clutter.ModifierType.CONTROL_MASK) !== 0;
            
            let openNewWindow = this.app.can_open_new_window() &&
                                this.app.state === Shell.AppState.RUNNING &&
                                (isCtrlPressed || isMiddleButton);

            if (this.app.state === Shell.AppState.STOPPED || openNewWindow)
                this.app.open_new_window(-1);
            else
                this.app.activate();

            // If clicked on an app NOT in the Dash, close immediately.
            if (!ext._isPointerInDashOrMenuOpen()) {
                Main.overview.hide();
            }
        };

        // 2. Start checking mouse position when Overview opens
        this._showingId = Main.overview.connect('showing', () => {
            this._wasInDash = false; 
            
            if (!this._monitorId) {
                this._monitorId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 150, this._monitorLoop.bind(this));
            }
        });

        // 3. Stop monitor when Overview closes
        this._hiddenId = Main.overview.connect('hidden', () => {
            this._cleanupMonitor();
        });
    }

    _monitorLoop() {
        if (!Main.overview.visible) {
            this._monitorId = null;
            return GLib.SOURCE_REMOVE;
        }

        let dash = Main.overview.dash;
        let showAppsBtn = dash ? (dash.showAppsButton || dash._showAppsIcon) : null;
        let searchEntry = Main.overview.searchEntry;

        // APP GRID EXCEPTION
        if (showAppsBtn && showAppsBtn.checked) {
            this._wasInDash = false; 
            return GLib.SOURCE_CONTINUE; 
        }

        // SEARCH EXCEPTION
        if (searchEntry && searchEntry.get_text() !== '') {
            this._wasInDash = false;
            return GLib.SOURCE_CONTINUE;
        }

        // MINIMIZED & GEOMETRICALLY OBSCURED WINDOW EXCEPTION
        let workspaceManager = global.workspace_manager;
        if (workspaceManager) {
            let activeWorkspace = workspaceManager.get_active_workspace();
            if (activeWorkspace) {
                let unsortedWindows = activeWorkspace.list_windows().filter(w => !w.is_skip_taskbar());
                
                // 1. Check for minimized windows
                let hasMinimized = unsortedWindows.some(w => w.minimized);
                let isFullyObscured = false;
                
                // 2. Check for geometrically obscured windows using Z-Order
                if (!hasMinimized && unsortedWindows.length > 1) {
                    // Sort windows by stacking order (from bottom/background to top/foreground)
                    let windows = global.display.sort_windows_by_stacking(unsortedWindows);
                    
                    for (let i = 0; i < windows.length; i++) {
                        let rectBelow = windows[i].get_frame_rect();
                        
                        // Compare ONLY with windows stacked ABOVE the current one (j > i)
                        for (let j = i + 1; j < windows.length; j++) {
                            let rectAbove = windows[j].get_frame_rect();
                            
                            // Check if the window ABOVE completely encloses the window BELOW
                            if (rectAbove.x <= rectBelow.x &&
                                rectAbove.y <= rectBelow.y &&
                                (rectAbove.x + rectAbove.width) >= (rectBelow.x + rectBelow.width) &&
                                (rectAbove.y + rectAbove.height) >= (rectBelow.y + rectBelow.height)) {
                                
                                isFullyObscured = true;
                                break;
                            }
                        }
                        if (isFullyObscured) break;
                    }
                }

                if (hasMinimized || isFullyObscured) {
                    this._wasInDash = false;
                    return GLib.SOURCE_CONTINUE;
                }
            }
        }

        // Evaluate whether the mouse is in the Dash OR if a context menu is open
        let inDashOrMenu = this._isPointerInDashOrMenuOpen();

        if (inDashOrMenu) {
            this._wasInDash = true;
        } else if (!inDashOrMenu && this._wasInDash) {
            // The mouse left the Dash and there are no open menus. Close it!
            Main.overview.hide();
            this._monitorId = null;
            return GLib.SOURCE_REMOVE;
        }

        return GLib.SOURCE_CONTINUE;
    }

    _isPointerInDashOrMenuOpen() {
        let dash = Main.overview.dash;
        if (dash) {
            let [pointerX, pointerY] = global.get_pointer();
            let [dashX, dashY] = dash.get_transformed_position();
            let [dashWidth, dashHeight] = dash.get_transformed_size();
            let margin = 10;
            
            if (pointerX >= dashX - margin && 
                pointerX <= dashX + dashWidth + margin &&
                pointerY >= dashY - margin && 
                pointerY <= dashY + dashHeight + margin) {
                return true;
            }
        }

        if (Main.popupMenuManager && Main.popupMenuManager.activeMenu) {
            return true;
        }

        if (dash && dash._box) {
            let items = dash._box.get_children();
            for (let item of items) {
                let icon = item.child || (item.get_first_child ? item.get_first_child() : item);
                if (icon) {
                    let menu = icon.menu || icon._menu || icon.popupMenu;
                    if (menu && menu.isOpen) return true;
                }
            }
        }

        let showAppsBtn = dash ? (dash.showAppsButton || dash._showAppsIcon) : null;
        if (showAppsBtn) {
            let menu = showAppsBtn.menu || showAppsBtn._menu || showAppsBtn.popupMenu;
            if (menu && menu.isOpen) return true;
        }

        return false;
    }

    _cleanupMonitor() {
        if (this._monitorId) {
            GLib.Source.remove(this._monitorId);
            this._monitorId = null;
        }
        this._wasInDash = false;
    }

    disable() {
        if (this._originalAppIconActivate) {
            AppDisplay.AppIcon.prototype.activate = this._originalAppIconActivate;
            this._originalAppIconActivate = null;
        }

        if (this._showingId) {
            Main.overview.disconnect(this._showingId);
            this._showingId = null;
        }

        if (this._hiddenId) {
            Main.overview.disconnect(this._hiddenId);
            this._hiddenId = null;
        }

        this._cleanupMonitor();
    }
}
