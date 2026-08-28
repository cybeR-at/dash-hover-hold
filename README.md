# 🖱️ Dash Hover Hold 🖱️

*To open everything up!*

A GNOME (50) extension that improves general initial multitasking. Natively, GNOME closes the Dash immediately after you click an app icon on it. With Dash Hover Hold, you can click and launch as many apps as you want: **the Dash will stay visible as long as you hover your mouse over it**. The Dash/Overview will only close once you move your cursor away from the Dash area allowing for dynamic hover control while preserving the native Dash/Overview general aesthetics.

**Recommendation**: *Dash Hover Hold* can be used independently, but it is an extension
created to work alongside others (mainly *Hot Edge,* but with *Mosaic* as well) for superior mouse functionality and experience with GNOME.

## 🚀 Installation

### Method 1: Via ZIP (Recommended)

Go to the [Releases](https://github.com/cybeR-at/dash-hover-hold/releases) tab of this repository and download the latest `.zip` file. Open your terminal and install it using:

```bash
gnome-extensions install dash-hover-hold@cyber-at.github.com.shell-extension.zip
```

Log out and log back in to restart your session. Enable the "Dash Hover Hold" extension in the GNOME Extensions Manager.

## Method 2: Manual Installation

Run the following commands in your terminal:

```Bash
git clone https://github.com/cybeR-at/dash-hover-hold.git
cd dash-hover-hold
mkdir -p ~/.local/share/gnome-shell/extensions/dash-hover-hold@cyber-at.github.com
cp extension.js metadata.json ~/.local/share/gnome-shell/extensions/dash-hover-hold@cyber-at.github.com/
```

After copying, log out of your session, log back in, and enable the extension.

This extension was done with the help of Gemini Pro and I tested it thoroughly.
