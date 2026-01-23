public with sharing class ContactTriggerHandler {
    
    public static void handleAfterInsert(List<Contact> recordNewList){
        try{
            String standardUserProfileId = '';
            List<Profile> standardUserProfileRec = [SELECT Id, Name FROM Profile WHERE Name = 'Standard Platform User'];
            if(standardUserProfileRec.isEmpty()) {  
                return;
            }
            
            for(Profile p : standardUserProfileRec){
                standardUserProfileId = p.Id;
            }
            
            List<User> usersToInsert = new List<User>();
            Id employeeRecTypeId = Schema.SObjectType.Contact.getRecordTypeInfosByDeveloperName().get('Employee_WF_Recon').getRecordTypeId();

            for(Contact con : recordNewList) {
                if(con.Email != null && con.RecordTypeId == employeeRecTypeId) {
                    String timeZoneKey = UserInfo.getTimeZone().getID();
                    String domainName = 'recon.com';
                    String userName = con.FirstName == null ? con.LastName.replaceAll(' ','') + '@' + domainName : con.FirstName.replaceAll(' ','') + con.LastName.replaceAll(' ','') + '@' + domainName;
                    String alias = con.FirstName?.length() > 8 ? con.FirstName.substring(0,8) : con.FirstName == null ? con.LastName.length() > 8 ? con.LastName.substring(0,8) : con.LastName : con.FirstName;
                    
                    User newUser = new User(
                        FirstName = con.FirstName == null ? null : con.FirstName,
                        LastName = con.LastName,
                        Email = con.Email,
                        Username = userName,
                        ProfileId = standardUserProfileId,
                        TimeZoneSidKey = timeZoneKey,
                        LanguageLocaleKey = 'en_US',
                        EmailEncodingKey = 'UTF-8',
                        LocaleSidKey = 'en_US',
                        Alias = alias
                    );
                    usersToInsert.add(newUser);
                }
            }
            
            if(!usersToInsert.isEmpty()){
                insert usersToInsert;
            }
        } catch(Exception e){
            throw new HandledException(WFEmployeeController.generateException(e.getMessage()));
        }
    }
}