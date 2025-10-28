({
	SaveSchedule : function(component, event, helper){
			var jobLookup = component.find("popupJobId");
			var recordId = component.get("v.recordId");
			var self = this;
			var mb = component.get("v.mobilizationGrpObject");
			mb.id = recordId;
			//mb.jobId = JobId;
			if(jobLookup){
				mb.jobId = jobLookup.get("v.selectedRecordId");
			}
			
	
			if(mb.startDate < mb.endDate){
				var action = component.get('c.SaveJobSchedule');
				action.setParams({
					mgp: JSON.parse(JSON.stringify(mb))
				});
		
				action.setCallback(this, function(response) {
					console.log('response', response.getReturnValue());
					var state = response.getState();
					if (state === "SUCCESS") {
						if(response.getReturnValue() == 'SUCCESS'){
						component.set("v.isModalOpen",false);
						$A.get('e.force:refreshView').fire();
						component.set("v.showSpinner", false);
						}else{
							self.toast.error('Something went wrong !!');
						}
					} else if (state === "ERROR"){
						try{
							self.toast.error(JSON.parse(response.getError()[0].message).message);
						}catch(e){
							self.toast.error(e.message);
						}
					}
					component.set("v.isModalOpen",false);
					component.set("v.showSpinner", false);
				});
				$A.enqueueAction(action);
				
				helper.ClearTempVariables(component, event, helper);
			}else if(mb.startDate == mb.endDate){
				self.toast.error('End date should be after start date.');
				component.set("v.showSpinner", false);
			}else{
				self.toast.error('End date should be after start date.');
				component.set("v.showSpinner", false);
			}
		},
		 ClearTempVariables : function(component, event, helper){
			var mobObject = component.get("v.mobilizationGrpObject");
			mobObject.jobId = '';
			mobObject.startDate = '';
			mobObject.endDate = '';
			mobObject.status = '';
			mobObject.name = '';
			mobObject.jobName = '';
			component.set("v.mobilizationGrpObject", mobObject);
		},
		 isRefreshed: function(component, event, helper) {
			
			location.reload();
		},
	
		fetchMobilizationGroupDetails: function(component) {
			var recordId = component.get('v.recordId');
			if(!recordId) return;
	
			var action = component.get('c.getMobilizationGroup');
			action.setParams({
				'recordId': recordId
			});
			action.setCallback(this, function(response) {
				var state = response.getState();
				if (state === "SUCCESS") {
					let result = response.getReturnValue();
					if(!result) return;
					console.log('getMobResult', result);
					component.set('v.mobilizationGrpObject', result);
				}else if (state === "ERROR"){
					try{
						helper.toast.error(JSON.parse(response.getError()[0].message).message);
					}catch(e){
						try{
							helper.toast.error(response.getError()[0].message);
						}catch(err){
							helper.toast.error(err.message);
						};
					}
				}
				component.set('v.showSpinner', false);
			});
			component.set('v.showSpinner', true);
			$A.enqueueAction(action);
		}
	   
	})