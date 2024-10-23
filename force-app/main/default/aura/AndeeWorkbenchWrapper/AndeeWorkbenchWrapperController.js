(
    { 
        doInit: function(component, event, helper) { // Disable back button 
            helper.disableBackButton(); 
        },

        handleDestroy: function(component, event, helper) {
            // Re-enable back button when component is destroyed.
            helper.enableBackButton();
        }
    }
)