import { LightningElement, api } from 'lwc';

export default class DisableBackButton extends LightningElement {
    isInitialized = false;
    stateId = null;

    connectedCallback() {
        this.preventBackNavigation();
    }

    disconnectedCallback() {
        // Remove the event listeners when the component is destroyed
        window.removeEventListener('popstate', this.handlePopState);
    }

    @api
    preventBackNavigation() {
        if (this.isInitialized) {
            return;
        }
        this.isInitialized = true;

        this.stateId = this.generateUniqueId();
        this.pushState();

        // Add event listeners
        window.addEventListener('popstate', this.handlePopState.bind(this));
    }

    pushState() {
        history.pushState({ id: this.stateId }, '');
    }

    handlePopState(event) {
        // Always prevent navigation and push state again
        event.preventDefault();
        if (event.state && event.state.id === this.stateId) {
            this.pushState();
        } else {
            this.stateId = this.generateUniqueId();
            this.pushState();
        }

        // Dispatch a custom event that the parent component can listen for
        this.dispatchEvent(new CustomEvent('backbuttonpressed', {
            bubbles: true,
            composed: true
        }));
    }

    generateUniqueId() {
        const uniqueId = 'id_' + Math.random().toString(36).substr(2, 9);
        return uniqueId;
    }
}

/*
Implementation in the parent component

JS:
    renderedCallback() {
        if (this.isBackNavigationPrevented) return;
        this.isBackNavigationPrevented = true;
        this.template.querySelector('c-disable-back-button').preventBackNavigation();
    }

    handleBackButtonPressed(event) {
        // Handle back button press here
        console.log('Back button was pressed');
        // You can add your custom logic here, like showing a warning message
    }



HTML:
    <template>
        <c-disable-back-button onbackbuttonpressed={handleBackButtonPressed}></c-disable-back-button>
        <!-- Your component's content -->
    </template>
*/