public class ContactTriggerHandler {
    public static void addUsersToContacts(List<Contact> newValues){
        
        List<String> contactswithNoEmail = new List<String>();
        try{
            List<String> contactsEmail = new List<String>();
            List<Contact> contactsToUpdate = fetchEmployeeContacts(newValues);
            Map<String,Id> userProfilesForTypes = getUserProfiles();
            if(userProfilesForTypes.isEmpty()) {  return;}
            for(Contact con : contactsToUpdate) {
                if(con.Email == null){
                    contactswithNoEmail.add(con.FirstName+' '+ con.LastName);
                }
                if(con.Email != null) {
                    contactsEmail.add(con.Email);
                }
            }
            if(!contactswithNoEmail.isEmpty()){
                throw new HandledException('No Email on Contacts');
            }
            Object[] argumentsUser = new Object[]{contactsEmail};
            List<User> listOfUsers =  Lib_Security.ws().dbQuery(createUsersQuery(), argumentsUser);
            List<User> usersToInsert = new List<User>();
            List<Id> usersToUpdate = new List<Id>();
            Map<String,User> usersWithId = new Map<String,User>();
            for(User u : listOfUsers) {
                usersWithId.put(u.FirstName + u.LastName + u.Email.substringBeforeLast('@'),u);
            }
            for(Contact con : contactsToUpdate) {
                User currentUser = usersWithId.get(con.FirstName + con.LastName + con.Email.substringBeforeLast('@'));
                if(currentUser != NULL) {
                    usersToUpdate.add(currentUser.Id);
                }
                else{
                    if(con.wfrecon__Can_Log_In_Out__c) {
                        usersToInsert.add(createNewUser(userProfilesForTypes.get('License'), con));
                    }
                    else{
                        usersToInsert.add(createNewUser(userProfilesForTypes.get('Non-License'), con));
                    }
                }
            }
            if(!usersToInsert.isEmpty()){
                List<Database.SaveResult> results = Lib_Security.ws().dbInsert(usersToInsert);
                for(Integer index = 0, size = results.size(); index < size; index++) {
                    User currentUser = usersToInsert[index];
                    currentUser.Id = results[index].getId();
                    usersWithId.put(currentUser.FirstName + currentUser.LastName + currentUser.Email.substringBeforeLast('@'), currentUser);
                }
            }
            if(!usersToUpdate.isEmpty()) {
                UpdateUsersForContacts.updateUsers(usersToUpdate);
            }
            for(Contact con : contactsToUpdate){
                User currentUser = usersWithId.get(con.FirstName + con.LastName + con.Email.substringBeforeLast('@'));
                if((currentUser != null) && (currentUser?.FirstName + ' ' +currentUser?.LastName ) == (con.FirstName + ' ' + con.LastName)) {
                    con.User__c = currentUser.Id;
                }
            }
        }
        catch(Exception e){
            throw new HandledException(WFEmployeeController.generateException(e.getMessage()));
        }
    }
    private static Map<String,Id> getUserProfiles() {
        Map<String,Id> userLicenseMap = new Map<String,Id>();
        List<User_License__c> userProfiles = User_License__c.getall().values();
        List<Profile> standardUserProfileRec = Lib_Security.ws().dbQuery(createProfilesQuery(),new Object[]{});
        for(Profile p : standardUserProfileRec){
            if(p.Name == 'Standard Platform User' && userProfiles.isEmpty()){
                userLicenseMap.put('License',p.Id);
            }
            else if(!userProfiles.isEmpty() && p.Name != 'Chatter Free User'){
                userLicenseMap.put('License',(Id) userProfiles[0].ProfileId__c);
            }
            else if(p.Name == 'Chatter Free User'){
                userLicenseMap.put('Non-License',p.Id);
            }
        }
        return userLicenseMap;
    }
    private static User createNewUser(Id profileToUse,Contact contactToRelate) {
        List<Company_Settings__c> userValues = Company_Settings__c.getall().values();
        String timeZoneKey = (userValues.isEmpty()) ? UserInfo.getTimeZone().getID() : userValues[0].Time_Zone_For_User__c;
        String domainName = (userValues.isEmpty()) ? 'recon.com' : userValues[0].Domain_Name__c;
        User newUser = new User(FirstName = contactToRelate.FirstName == null ? null : contactToRelate.FirstName,LastName = contactToRelate.LastName,Email = contactToRelate.Email,Crew_User__c = true,ProfileId = profileToUse,TimeZoneSidKey = timeZoneKey,
                                LanguageLocaleKey = 'en_US',
                                EmailEncodingKey = 'UTF-8',
                                LocaleSidKey = 'en_US');
        newUser.Alias = contactToRelate.FirstName?.length() > 8 ? contactToRelate.FirstName.substring(0,8) : contactToRelate.FirstName == null ? contactToRelate.LastName.length() > 8 ? contactToRelate.LastName.substring(0,8) : contactToRelate.LastName : contactToRelate.FirstName   ;
        newUser.Username = contactToRelate.FirstName == null ? contactToRelate.LastName.replaceAll(' ','') + '@' + domainName : contactToRelate.FirstName.replaceAll(' ','') + contactToRelate.LastName.replaceAll(' ','') + '@' + domainName;
        return newUser;
    }
    private static List<Contact> fetchEmployeeContacts(List<Contact> newValues) {
        List<Contact> contactsToUpdate = new List<Contact>();
        Id contactRecordType = Schema.SObjectType.Contact.getRecordTypeInfosByDeveloperName()
                      .get('Employee_WF_Recon').getRecordTypeId();
        for(Contact con : newValues) {
            if((con.RecordTypeId != contactRecordType) || (con.User__c != null) || (!con.Is_Visible_On_Scheduler__c && !con.Can_Log_In_Out__c)) { continue;}
            contactsToUpdate.add(con);
        }
        return contactsToUpdate;
    } 
    private static String createUsersQuery() {
        return 'SELECT ' + 
            'Id,FirstName,LastName,Crew_User__c,Email,ProfileId ' +
            'FROM USER '+
            'WHERE Email in :arg1';
    }
    private static String createProfilesQuery(){
        return 'SELECT ' +
            'Id,Name ' +
            'FROM Profile ' +
            'WHERE Name = \'Standard Platform User\' OR ' + 
            'Name = \'Chatter Free User\'';  
    }
}