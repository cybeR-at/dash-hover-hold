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

        // APP GRID EXCEPTION (Second Overview)
        // If the "Show Applications" button is "checked" (App Grid is open),
        // we pause the hover-to-close logic.
        if (showAppsBtn && showAppsBtn.checked) {
            // Reset the variable to prevent accidentally closing the overview 
            // when the user closes the App Grid and the mouse is outside the Dash.
            this._wasInDash = false; 
            return GLib.SOURCE_CONTINUE; 
        }

        // SEARCH EXCEPTION
        // If there is text in the search entry, the user is looking at search results.
        // We pause the hover-to-close logic so they can move the mouse up to click them.
        if (searchEntry && searchEntry.get_text() !== '') {
            this._wasInDash = false;
            return GLib.SOURCE_CONTINUE;
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
        // 1. Geometric Check (Dash Area)
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

        // 2. GNOME Global Menu Manager Check
        if (Main.popupMenuManager && Main.popupMenuManager.activeMenu) {
            return true;
        }

        // 3. Deep check on Dash icons
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

        // 4. Check the Show Apps button menu
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
