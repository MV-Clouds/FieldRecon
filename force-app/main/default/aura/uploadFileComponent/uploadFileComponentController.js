({  
    // Load current profile picture
    onInit: function(component) {
        var action = component.get("c.getProfilePicture"); 
        action.setCallback(this, function(a) {
            var state = a.getState();
            if(state === 'SUCCESS'){
                var attachment = a.getReturnValue();
                
                if (attachment && attachment.Id) {
                    component.set('v.pictureSrc', '/servlet/servlet.FileDownload?file='+attachment.Id);
                }
            }else if (state === "ERROR"){
                try{
                    helper.toast.error(JSON.parse(response.getError()[0].message).message);
                }catch(e){
                    try{
                        helper.toast.error(response.getError()[0].message);
                    }catch(err){
                        helper.toast.error(err.message);
                    }
                }
            }
        });
        $A.enqueueAction(action); 
    },
    
    onDragOver: function(component, event) {
        event.preventDefault();  
        component.set('v.loaded',true);   
    },

    onDrop: function(component, event, helper) {
		event.stopPropagation();
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
        var files = event.dataTransfer.files;
        if (files.length>1) {
            return helper.toast.error('You can only upload one profile picture');
        }
        helper.readFile(component, helper, files[0]);
        
    },
    
    
})