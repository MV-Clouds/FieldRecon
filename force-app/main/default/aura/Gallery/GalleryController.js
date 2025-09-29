({
    doInit : function(component, event, helper){
        component.set('v.Spinner',true);
        helper.getImages(component, event, helper);
        component.set('v.Spinner',false);
    },

    getNextRecord : function(component, event, helper){
        helper.getNextRecord(component, event, helper);
    },
    
    onupload: function(component, event, helper){
        helper.getImages(component, event, helper);
    },
    
    viewAll : function (component, event, helper) {
        
        var fetchedrecord = component.get("v.fatchedRecordNo");
        var tab = component.get("v.selectedtab");
	    var gallery = component.get("v.Galleryfiles");
	    var chatter = component.get("v.Chatterfiles");
	    
	    var files = [];
	   
	    if(tab == 'Gallery'){
	        fetchedrecord = fetchedrecord + 6 >= gallery.length ? gallery.length : fetchedrecord + 6;
            helper.prepareFilesMap(component,gallery,5);
            if(fetchedrecord == gallery.length){
                helper.toast.info("No more files found.");
            }
	    }else if(tab == 'Chatter'){
	        fetchedrecord = fetchedrecord + 6 >= chatter.length ? chatter.length : fetchedrecord + 6;
            helper.prepareFilesMap(component,chatter,5);
            if(fetchedrecord == chatter.length){
                helper.toast.info("No more files found.");
            }
	    }
        component.set("v.fatchedRecordNo", fetchedrecord);
        component.set('v.files', files);
     },
     
    openChat : function (component, event, helper) {
          var recordId = event.getSource().get("v.value");
          window.open('/lightning/r/'+recordId+'/view');
     },
     
     handleSelect: function (component, event, helper) {
         helper.handleSelect(component,event,helper);
    },
})