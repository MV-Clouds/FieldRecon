public with sharing class ScheduleNotificationClass {
    
    public class NotificationRequest {
        @InvocableVariable(required=true label='Record Id' description='The ID of the record related to the notification')
        public Id recordId;
        
        @InvocableVariable(required=true label='Notification Content' description='The content/message body of the notification')
        public String content;
    }
    
    @InvocableMethod(label='Send Custom Notification' 
                    description='Sends a custom notification to approvers defined in custom metadata' 
                    category='Notification')
    public static void sendCustomNotification(List<NotificationRequest> requests) {
        for (NotificationRequest request : requests) {
            sendCustomNotificationToApprovers(request.recordId, request.content);
        }
    }
    
    private static void sendCustomNotificationToApprovers(Id recordId, String content) {
        try {
            // Query the metadata to get approver user IDs
            List<Log_Entry_Approver__mdt> approverMetadata = [
                SELECT Id, Label, Approvers_JSON__c 
                FROM Log_Entry_Approver__mdt 
                WHERE DeveloperName = 'Approvers_JSON' 
                LIMIT 1
            ];
            
            Set<String> addressee = new Set<String>();
            
            // Parse approvers JSON from metadata
            if (!approverMetadata.isEmpty() && String.isNotBlank(approverMetadata[0].Approvers_JSON__c)) {
                try {
                    Map<String, Object> approversMap = (Map<String, Object>) JSON.deserializeUntyped(approverMetadata[0].Approvers_JSON__c);
                    
                    // Extract user IDs from the JSON (values in the map)
                    for (String userName : approversMap.keySet()) {
                        Object userIdObj = approversMap.get(userName);
                        if (userIdObj != null) {
                            String userId = String.valueOf(userIdObj);
                            if (String.isNotBlank(userId)) {
                                addressee.add(userId);
                            }
                        }
                    }
                } catch (Exception jsonEx) {
                    System.debug('Error parsing approvers JSON: ' + jsonEx.getMessage());
                }
            }
            
            // If no approvers found in metadata
            if (addressee.isEmpty()) {
                System.debug('No approvers found in metadata');
                return;
            }
            
            // Query for Custom Notification Type
            List<CustomNotificationType> cnType = [
                SELECT Id 
                FROM CustomNotificationType 
                WHERE DeveloperName = 'Field_Recon_Notification' 
                LIMIT 1
            ];
            
            if (cnType.isEmpty()) {
                System.debug('No Custom Notification Type found with DeveloperName: Field_Recon_Notification');
                return;
            }
            
            // Send notification if we have addressees
            if (!addressee.isEmpty()) {
                Map<String, Object> pageRef = new Map<String, Object>{
                    'type' => 'standard__navItemPage',
                    'attributes' => new Map<String, Object>{
                        'apiName' => 'wfrecon__Shift_Log_Approval' // Tab API Name
                    }
                };
                String title = 'Shift Entry Log Pending Approval';

                Messaging.CustomNotification customNotificationObj = new Messaging.CustomNotification();
                customNotificationObj.setBody(content);
                customNotificationObj.setTitle(title);
                customNotificationObj.setNotificationTypeId(cnType[0].Id);
                customNotificationObj.setTargetPageRef(JSON.serialize(pageRef));
                customNotificationObj.send(addressee);
                
                System.debug('Custom notification sent to ' + addressee.size() + ' users for record: ' + recordId);
            } else {
                System.debug('No addressees found to send notification');
            }
            
        } catch (Exception e) {
            // Log the exception but don't fail the main transaction
            ExceptionHandler.logException(new Map<String, Object>{
                'className' => 'ScheduleNotificationClass',
                'methodName' => 'sendCustomNotificationToApprovers',
                'exceptionObj' => e,
                'moreDetails' => 'Error sending custom notification for record: ' + recordId + ' - ' + e.getMessage()
            });
            System.debug('Error sending custom notification: ' + e.getMessage());
        }
    }
}