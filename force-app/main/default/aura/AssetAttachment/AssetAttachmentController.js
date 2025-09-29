({
    doInit : function(component, event, helper){
        helper.getImages(component, event, helper);
    },
    
     openChat : function (component, event, helper) {
          var recordId = event.getSource().get("v.value");
          window.open('/lightning/r/'+recordId+'/view');
     },
     refresh : function (component, event, helper){
          helper.getImages(component, event, helper);
     }
     
})