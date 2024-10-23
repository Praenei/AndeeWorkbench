(
    { 
        disableBackButton: function() { 
            window.history.pushState(null, '', window.location.href); 
            window.addEventListener('popstate', this.handlePopState); },

        enableBackButton: function() {
            window.removeEventListener('popstate', this.handlePopState);
        },

        handlePopState: function(event) {
            window.history.pushState(null, '', window.location.href);
        }
    }
)
