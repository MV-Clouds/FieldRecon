({
    readFile: function(component, helper, file) {
        if (!file) return;
        if (!file.type.match(/(image.*)/)) {
            return this.toast.error('Image file not supported');
        }  
        
        var reader = new FileReader();
        reader.onloadend = function() {
            var dataURL = reader.result;
            
            component.set("v.pictureSrc", dataURL);
            helper.upload(component, file, dataURL.match(/,(.*)$/)[1]);
        };
        reader.readAsDataURL(file);
        
	},
    
    upload: function(component, file, base64Data) {  
        var self = this;
        var action = component.get("c.saveAttachment"); 
        action.setParams({
            fileName: file.name,
            base64Data: base64Data, 
            contentType: file.type
        });
        action.setCallback(this, function(a) {
            var state = a.getState();
            if(state === 'SUCCESS'){
                component.set("v.message", "Image uploaded");  
            }else if (state === "ERROR"){
                try{
                    self.toast.error(JSON.parse(response.getError()[0].message).message);
                }catch(e){
                    try{
                        self.toast.error(response.getError()[0].message);
                    }catch(err){
                        self.toast.error(err.message);
                    }
                }
            }
        });
        $A.enqueueAction(action); 
    },
})