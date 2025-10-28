({
    addToastEventListener: function(component) {
        window.addEventListener("message", function(evt) {
            var toastEvent = $A.get('e.force:showToast');
            toastEvent.setParams({
                type: evt.data.type,
                message: evt.data.message,
                mode: evt.data.mode
            });
            toastEvent.fire();
        }, false);
    }
  
})