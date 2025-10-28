import { LightningElement, api } from "lwc";

export default class CustomDatatableClickableLink extends LightningElement {
  @api linkId;
  @api label;
  @api name;

  onLinkClick() {
    var goto = this.template.querySelector('[data-id="view"]');
    window.scrollTo(0,goto.offsetTop);
    this.dispatchEvent(
      new CustomEvent("linkclicked", {
        composed: true,
        bubbles: true,
        cancelable: true,
        detail: {
          name: this.name,
          linkId: this.linkId
        }
      })
    );
  }
}