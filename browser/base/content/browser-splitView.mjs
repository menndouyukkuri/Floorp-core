/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * @class SplitView
 * @description The SplitView class is responsible for handling the split view functionality.
 * @license MPL2.0 : This code inspired by the split view feature in the Zen Browser Thanks to the Zen Browser team!
 */
export class SplitView {
  constructor() {
    this._data = [];
    this.currentView = -1;
    this._tabBrowserPanel = null;
    this.__modifierElement = null;
    this.__hasSetMenuListener = false;

    Services.prefs.setBoolPref("floorp.browser.splitView.working", false);
    window.addEventListener("TabClose", event => this.handleTabClose(event));
    this.initializeContextMenu();
  }

  /**
   * @param {Event} event - The event that triggered the tab close.
   * @description Handles the tab close event.7
   */
  handleTabClose(event) {
    const tab = event.target;
    const groupIndex = this._data.findIndex(group => group.tabs.includes(tab));
    if (groupIndex < 0) {
      return;
    }
    this.removeTabFromGroup(tab, groupIndex, event.forUnsplit);
  }

  /**
   * Removes a tab from a group.
   *
   * @param {Tab} tab - The tab to remove.
   * @param {number} groupIndex - The index of the group.
   * @param {boolean} forUnsplit - Indicates if the tab is being removed for unsplitting.
   */
  removeTabFromGroup(tab, groupIndex, forUnsplit) {
    const group = this._data[groupIndex];
    const tabIndex = group.tabs.indexOf(tab);
    group.tabs.splice(tabIndex, 1);

    this.resetTabState(tab, forUnsplit);

    if (group.tabs.length < 2) {
      this.removeGroup(groupIndex);
    } else {
      this.updateSplitView(group.tabs[group.tabs.length - 1]);
    }
  }

  /**
   * Resets the state of a tab.
   *
   * @param {Tab} tab - The tab to reset.
   * @param {boolean} forUnsplit - Indicates if the tab is being reset for unsplitting.
   */
  resetTabState(tab, forUnsplit) {
    tab.splitView = false;
    tab.linkedBrowser.spliting = false;
    const container = tab.linkedBrowser.closest(".browserSidebarContainer");
    container.removeAttribute("split");
    container.removeAttribute("style");

    if (!forUnsplit) {
      tab.linkedBrowser.docShellIsActive = false;
      container.style.display = "none";
    } else {
      container.style.flex = "";
      container.style.order = "";
    }
  }

  /**
   * Removes a group.
   *
   * @param {number} groupIndex - The index of the group to remove.
   */
  removeGroup(groupIndex) {
    if (this.currentView === groupIndex) {
      this.resetSplitView();
    }
    this._data.splice(groupIndex, 1);
  }

  /**
   * Resets the split view.
   */
  resetSplitView() {
    for (const tab of this._data[this.currentView].tabs) {
      this.resetTabState(tab, true);
    }

    this.currentView = -1;
    this.tabBrowserPanel.removeAttribute("split-view");
    this.tabBrowserPanel.style.display = "";
    this.tabBrowserPanel.style.flexDirection = "";
    Services.prefs.setBoolPref("floorp.browser.splitView.working", false);
  }

  /**
   * Inserts the split view tab context menu item.
   */
  insertSplitViewTabContextMenu() {
    const element = window.MozXULElement.parseXULToFragment(`
      <menuseparator/>
      <menuitem id="context_splittabs" data-l10n-id="floorp-split-view-open-menu" oncommand="gSplitView.contextSplitTabs();"/>
      <menuitem id="context_splittabs" data-l10n-id="floorp-split-view-close-menu" oncommand="gSplitView.unsplitCurrentView();"/>
      <menuseparator/>
    `);
    document.getElementById("context_closeDuplicateTabs").after(element);
  }

  /**
   * Initializes the context menu.
   */
  initializeContextMenu() {
    this.insertSplitViewTabContextMenu();
  }

  /**
   * Gets the tab browser panel.
   *
   * @returns {Element} The tab browser panel.
   */
  get tabBrowserPanel() {
    if (!this._tabBrowserPanel) {
      this._tabBrowserPanel = document.getElementById("tabbrowser-tabpanels");
    }
    return this._tabBrowserPanel;
  }

  /**
   * Splits the selected tabs.
   */
  contextSplitTabs() {
    if (window.TabContextMenu.contextTab === window.gBrowser.selectedTab) {
      return;
    }
    const tab = [window.TabContextMenu.contextTab, window.gBrowser.selectedTab];
    this.splitTabs(tab);
  }

  /**
   * Handles the location change event.
   *
   * @param {Browser} browser - The browser instance.
   */
  onLocationChange(browser) {
    const tab = window.gBrowser.getTabForBrowser(browser);
    if (tab) {
      this.updateSplitView(tab);
    }
  }

  /**
   * Splits the given tabs.
   *
   * @param {Tab[]} tabs - The tabs to split.
   */
  splitTabs(tabs) {
    const existingSplitTab = tabs.find(tab => tab.splitView);
    if (existingSplitTab) {
      const groupIndex = this._data.findIndex(group =>
        group.tabs.includes(existingSplitTab)
      );
      if (groupIndex >= 0) {
        this.updateSplitView(existingSplitTab);
        return;
      }
    }

    this._data.push({
      tabs,
      flexType: "flex",
    });
    window.gBrowser.selectedTab = tabs[0];
    this.updateSplitView(tabs[0]);
  }

  /**
   * Updates the split view.
   *
   * @param {Tab} tab - The tab to update the split view for.
   */
  updateSplitView(tab) {
    const splitData = this._data.find(group => group.tabs.includes(tab));
    if (
      !splitData ||
      (this.currentView >= 0 &&
        !this._data[this.currentView].tabs.includes(tab))
    ) {
      if (this.currentView >= 0) {
        this.deactivateSplitView();
      }
      if (!splitData) {
        return;
      }
    }

    this.activateSplitView(splitData, tab);
  }

  /**
   * Deactivates the split view.
   */
  deactivateSplitView() {
    for (const tab of this._data[this.currentView].tabs) {
      const container = tab.linkedBrowser.closest(".browserSidebarContainer");
      this.resetContainerStyle(container);
      container.removeEventListener("click", this.handleTabClick);
    }
    this.tabBrowserPanel.removeAttribute("split-view");
    this.tabBrowserPanel.style.flexTemplateAreas = "";
    Services.prefs.setBoolPref("floorp.browser.splitView.working", false);
    this.setTabsDocShellState(this._data[this.currentView].tabs, false);
    this.currentView = -1;
  }

  /**
   * Activates the split view.
   *
   * @param {object} splitData - The split data.
   * @param {Tab} activeTab - The active tab.
   */
  activateSplitView(splitData, activeTab) {
    this.tabBrowserPanel.setAttribute("split-view", "true");
    Services.prefs.setBoolPref("floorp.browser.splitView.working", true);
    this.currentView = this._data.indexOf(splitData);

    const flexType = splitData.flexType || "flex";
    this.applyFlexBoxLayout(splitData.tabs, flexType, activeTab);

    this.setTabsDocShellState(splitData.tabs, true);
  }

  /**
   * Applies the flex layout to the tabs.
   *
   * @param {Tab[]} tabs - The tabs to apply the flex layout to.
   * @param {string} flexType - The type of flex layout.
   * @param {Tab} activeTab - The active tab.
   */
  applyFlexBoxLayout(tabs, flexType, activeTab) {
    this.tabBrowserPanel.style.flexDirection = "column";
    tabs.forEach((tab, index) => {
      tab.splitView = true;
      const container = tab.linkedBrowser.closest(".browserSidebarContainer");
      this.styleContainer(container, tab === activeTab, index, flexType);
    });
  }

  /**
   * Styles the container for a tab.
   *
   * @param {Element} container - The container element.
   * @param {boolean} isActive - Indicates if the tab is active.
   * @param {number} index - The index of the tab.
   * @param {string} flexType - The type of flex layout.
   */
  styleContainer(container, isActive, index, flexType) {
    container.removeAttribute("split-active");
    if (isActive) {
      container.setAttribute("split-active", "true");
    }
    container.setAttribute("split-anim", "true");
    container.addEventListener("click", this.handleTabClick);

    if (flexType === "flex") {
      container.style.flex = "1";
      container.style.order = index;
    }
  }

  /**
   * Handles the tab click event.
   *
   * @param {Event} event - The click event.
   */
  handleTabClick = event => {
    const container = event.currentTarget;
    const tab = window.gBrowser.tabs.find(
      t => t.linkedBrowser.closest(".browserSidebarContainer") === container
    );
    if (tab) {
      window.gBrowser.selectedTab = tab;
    }
  };

  /**
   * Sets the docshell state for the tabs.
   *
   * @param {Tab[]} tabs - The tabs.
   * @param {boolean} active - Indicates if the tabs are active.
   */
  setTabsDocShellState(tabs, active) {
    for (const tab of tabs) {
      tab.linkedBrowser.spliting = active;
      tab.linkedBrowser.docShellIsActive = active;
      const browser = tab.linkedBrowser.closest(".browserSidebarContainer");
      if (active) {
        browser.setAttribute("split", "true");
        const currentStyle = browser.getAttribute("style");
        browser.setAttribute(
          "style",
          `${currentStyle}
          -moz-subtree-hidden-only-visually: 0;
          visibility: visible !important;`
        );
      } else {
        browser.removeAttribute("split");
        browser.removeAttribute("style");
      }
    }
  }

  /**
   * Resets the container style.
   *
   * @param {Element} container - The container element.
   */
  resetContainerStyle(container) {
    container.removeAttribute("split-active");
    container.classList.remove("deck-selected");
    container.style.flex = "";
    container.style.order = "";
  }

  /**
   * Gets the modifier element.
   *
   * @returns {Element} The modifier element.
   */
  get modifierElement() {
    if (!this.__modifierElement) {
      const wrapper = document.getElementById("template-split-view-modifier");
      const panel = wrapper.content.firstElementChild;
      wrapper.replaceWith(wrapper.content);
      this.__modifierElement = panel;
    }
    return this.__modifierElement;
  }

  /**
   * @description unsplit the current view.]
   */
  unsplitCurrentView() {
    const currentTab = window.gBrowser.selectedTab;
    const tabs = this._data[this.currentView].tabs;
    for (const tab of tabs) {
      this.handleTabClose({ target: tab, forUnsplit: true });
    }
    window.gBrowser.selectedTab = currentTab;
  }

  /**
   * @description opens a new tab and switches to it.
   * @param {string} url - The url to open
   * @param {object} options - The options for the tab
   * @returns {tab} The tab that was opened
   */
  openAndSwitchToTab(url, options) {
    const parentWindow = window.ownerGlobal.parent;
    const targetWindow = parentWindow || window;
    const tab = targetWindow.gBrowser.addTrustedTab(url, options);
    targetWindow.gBrowser.selectedTab = tab;
    return tab;
  }
}
