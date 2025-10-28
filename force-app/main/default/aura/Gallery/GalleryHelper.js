({
	getImages : function(component, event, helper){  
		var jobID  = component.get("v.recordId");  
		var action = component.get("c.getContents");
		var files  = component.get("v.files");
        action.setParams({
			"jobID" : jobID
		});
        var self = this;
		
        action.setCallback(this, function(response) {
            var state = response.getState();
            if(component.isValid() && state === 'SUCCESS') {
                var result = response.getReturnValue();
                var galleryImage = [];
                var chatterImage = [];
                  for(var i=0; i<result.length; i++){
                      if(result[i].feedId != '' ){
                          chatterImage.push(result[i]);
                      }else{
                          galleryImage.push(result[i]);
                      }
                  }
                  
                component.set('v.Chatterfiles', chatterImage);
                component.set('v.Galleryfiles', galleryImage);
                helper.prepareFilesMap(component,chatterImage,5);

				component.set("v.files", files); 
				helper.handleSelect(component,event,helper);
				 
            } else if (state === "ERROR"){
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
	 
	handleSelect: function (component, event, helper) {
         
	    var tab = component.get("v.selectedtab");
	    var gallery = component.get("v.Galleryfiles");
	    var chatter = component.get("v.Chatterfiles");
        var fetchedrecord = component.get("v.fatchedRecordNo");
	    
	    var files = [];
        
	    if(tab == 'Gallery'){
            helper.prepareFilesMap(component,gallery,fetchedrecord);           
	    }else if(tab == 'Chatter'){
            helper.prepareFilesMap(component,chatter,fetchedrecord);
	    }
	     component.set('v.files', files);
    },
    prepareFilesMap: function (component,gallery,fetchedrecord) {
        var fileMap = [];
        for(var i=0; i< gallery.length; i++){
            var index = fileMap.map(function(item) { return item.recordId; }).indexOf(gallery[i].parentId);
            if(index === -1){
                fileMap.push({fileId:[gallery[i].fileId],Name:gallery[i].parentName,recordId:gallery[i].parentId});
            }else{
                fileMap[index].fileId.push(gallery[i].fileId);
            }
            if(i == fetchedrecord){
                  break;
              }
        }
        component.set('v.filesMap', fileMap);
    }
})