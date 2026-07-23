(() => {
  "use strict";
  const byId = (id) => document.getElementById(id);
  function cloneAvatar(source, target) {
    if (!source || !target) return;
    const image = source.querySelector("img");
    if (image) { target.innerHTML = ""; const copy = image.cloneNode(true); copy.removeAttribute("id"); target.appendChild(copy); return; }
    target.textContent = source.textContent?.trim() || "?";
  }
  function initMobileProfileMenu() {
    const trigger = byId("mobileProfileMenuTrigger");
    const sheet = byId("mobileProfileSheet");
    const backdrop = byId("mobileProfileSheetBackdrop");
    const closeButton = byId("mobileProfileSheetClose");
    if (!trigger || !sheet || !backdrop || !closeButton) return;
    const dashboardAvatar = byId("mobileDashboardAvatar");
    const dashboardName = byId("mobileDashboardName");
    const sheetAvatar = byId("mobileProfileSheetAvatar");
    const sheetTitle = byId("mobileProfileSheetTitle");
    const sheetViewProfile = byId("mobileSheetViewProfile");
    const desktopViewProfile = byId("viewPublicProfileLink");
    if (desktopViewProfile?.href && sheetViewProfile) sheetViewProfile.href = desktopViewProfile.href;
    const syncIdentity = () => { cloneAvatar(dashboardAvatar, sheetAvatar); if (dashboardName && sheetTitle) sheetTitle.textContent = dashboardName.textContent?.trim() || "My creator profile"; };
    const openSheet = () => { syncIdentity(); backdrop.hidden = false; sheet.hidden = false; trigger.setAttribute("aria-expanded", "true"); document.body.classList.add("mobile-profile-sheet-open"); requestAnimationFrame(() => closeButton.focus()); };
    const closeSheet = ({restoreFocus=true}={}) => { sheet.hidden = true; backdrop.hidden = true; trigger.setAttribute("aria-expanded", "false"); document.body.classList.remove("mobile-profile-sheet-open"); if (restoreFocus) trigger.focus(); };
    trigger.addEventListener("click", () => sheet.hidden ? openSheet() : closeSheet());
    closeButton.addEventListener("click", () => closeSheet());
    backdrop.addEventListener("click", () => closeSheet());
    sheet.addEventListener("click", (event) => {
      const action = event.target.closest("[data-profile-action]"); if (!action) return;
      if (action.dataset.profileAction === "edit") {
        closeSheet({restoreFocus:false});
        const editButton = byId("mobileEditCreatorProfileButton") || byId("editCreatorProfileButton") || byId("mobileQuickEditProfile") || byId("quickEditProfile");
        if (editButton) { editButton.click(); setTimeout(() => byId("creatorProfileEditor")?.scrollIntoView({behavior:"smooth",block:"start"}), 100); }
      }
      if (action.dataset.profileAction === "logout") {
        closeSheet({restoreFocus:false});
        const logoutButton = byId("dashboardLogoutButton");
        if (logoutButton) logoutButton.click(); else console.error("LaunchBoard: dashboardLogoutButton was not found.");
      }
    });
    document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !sheet.hidden) closeSheet(); });
    const observer = new MutationObserver(syncIdentity);
    if (dashboardAvatar) observer.observe(dashboardAvatar,{childList:true,subtree:true,characterData:true});
    if (dashboardName) observer.observe(dashboardName,{childList:true,subtree:true,characterData:true});
    syncIdentity();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initMobileProfileMenu); else initMobileProfileMenu();
})();
