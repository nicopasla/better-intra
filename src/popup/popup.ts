import { initAccountSettings } from "../features/account/account.ui";
import CSS from "../assets/style.css?inline";

const style = document.createElement("style");
style.textContent = CSS;
document.head.appendChild(style);

const root = document.getElementById("account-root");
if (root) initAccountSettings(root);
