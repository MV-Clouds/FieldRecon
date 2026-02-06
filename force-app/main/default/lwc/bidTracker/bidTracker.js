import { LightningElement } from 'lwc';

export default class BidTracker extends LightningElement {
    // Tab state
    activeTab = 'bidsList';

    // Computed properties for tab classes
    get bidsListTabClass() {
        return this.activeTab === 'bidsList' ? 'tab-button active' : 'tab-button';
    }

    get bidCalendarTabClass() {
        return this.activeTab === 'bidCalendar' ? 'tab-button active' : 'tab-button';
    }

    // Computed properties for tab content visibility
    get isBidsListTabActive() {
        return this.activeTab === 'bidsList';
    }

    get isBidCalendarTabActive() {
        return this.activeTab === 'bidCalendar';
    }

    // Tab click handlers
    handleBidsListTab() {
        this.activeTab = 'bidsList';
    }

    handleBidCalendarTab() {
        this.activeTab = 'bidCalendar';
    }
}