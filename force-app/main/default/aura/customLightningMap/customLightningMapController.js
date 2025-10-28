({
	 doInit: function(component, event, helper) {
           var action = component.get("c.getDefaults");
           var self = this;
          
           action.setParams({ 
               "JobId" : component.get("v.recordId")
           });
          
        
        action.setCallback(this, function(response) {
        var state = response.getState();    
            if (state === "SUCCESS") {
                  
                var res = response.getReturnValue();
                component.set('v.Job',response.getReturnValue());
                component.set('v.mapMarkersData',[{
                    location : {
                        Country    : res[0].Country,
                        Street     : res[0].Street,
                        City       : res[0].City,
                        State      : res[0].State,
                        PostalCode : res[0].PostalCode

                    },
                title: res[0].title,
                
            }]); 
        
                component.set('v.mapCenter',[{
                    location : {
                        Country    : res[0].Country,
                    },
                }]);  
            
                component.set('v.markersTitleData', 'Job locations');
                component.set('v.totalJob',response.getReturnValue().length);
                component.set('v.crew',response.getReturnValue());
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
    openingoogle: function(component, event, helper){
		
		var jobAddress = component.get('v.Job');
		window.open('https://www.google.com/maps/search/?api=1&query='+jobAddress[0].Street+jobAddress[0].City+jobAddress[0].State+jobAddress[0].PostalCode+jobAddress[0].Country);
	}
})