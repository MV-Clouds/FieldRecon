({
    doInit: function(component,event,helper){
        var action = component.get("c.getDefaults");
        var recordId = component.get("v.recordId");
        var self = this;
        action.setParams({
            recordId : recordId 
        });
        action.setCallback(this,function(response){
            var state = response.getState();
            if(state === "SUCCESS"){
                  var res = response.getReturnValue();
                 component.set('v.StockQuantity',res.Quantity);
                
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
    
    AddQuantityAsset : function(component, event, helper) {
		var action= component.get("c.AddQuantity");
        var self = this;
        var Quan = component.get("v.Quantity");
        var recordId = component.get("v.recordId");
        action.setParams({
            Quan : Quan,
            recordId : recordId
        });
        action.setCallback(this,function(response){
            var state = response.getState();
            if(state == "SUCCESS"){
                self.toast.success("Quantity Added Successfully");
                $A.get("e.force:closeQuickAction").fire();
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
    RemoveQuantityAsset : function(component, event, helper) {
        var Quan = component.get('v.Quantity');
        var self = this;
        var StockQuan = component.get('v.StockQuantity');
        
        if(StockQuan >= Quan ){
            var action= component.get('c.RemoveQuantity');
            var recordId = component.get('v.recordId');
            action.setParams({
                Quan : Quan,
                recordId : recordId
            });
            action.setCallback(this,function(response){
                var state=response.getState();
                if(state == 'SUCCESS'){
                    self.toast.success("Quantity Removed Successfully");
                    $A.get("e.force:closeQuickAction").fire();
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
        }else{
            self.toast.error("Entered Quantity is greater than total Quantity");
        }
	},
})