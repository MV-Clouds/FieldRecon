/*
    This class is without sharing as
    we are using Setup Objects in 
    Query, these should not take
    into consideration user 
    permissions to upgrade the
    feature parameter. 
    Objects used :- 
    *PermissionSet
    *PermissionSetAssignment
*/
public without sharing class BatchFeatureUpdate implements Database.Batchable<sObject>, Database.Stateful{
    private Id permissionSetId;
    private String errorMsg;

    public Database.QueryLocator start(Database.BatchableContext BC){
        this.getPermissionSetId();
        String query = 'SELECT AssigneeId,PermissionSetId,Assignee.Name,Assignee.Profile.Name FROM PermissionSetAssignment WHERE PermissionSet.Name LIKE \'%WF_Recon%\' ' +
                        'AND Assignee.IsActive = TRUE ' +
                        'AND PermissionSetId !=\'' + (Id)this.permissionSetId + '\'';   
        if(Test.isRunningTest()) {
            query += ' AND Assignee.Name = \'Test Contact-1\'';
        }
        return Database.getQueryLocator(query);
    }
    public void execute(Database.BatchableContext BC, List<PermissionSetAssignment> permissionSetsUsers){
        Set<PermissionSetAssignment> permissionsToAdd = new Set<PermissionSetAssignment>();
        Set<PermissionSetAssignment> permissionsToRemove = new Set<PermissionSetAssignment>();
        Map<Id,Set<PermissionSetAssignment>> permissionsToHandle = new Map<Id,Set<PermissionSetAssignment>>();
        List<Id> idsOfUsers = new List<Id>();
        if(this.permissionSetId == null) { return;}
        for(PermissionSetAssignment psa : permissionSetsUsers){
            idsOfUsers.add(psa.AssigneeId);
        }
        permissionsToHandle = this.convertListToMap(this.checkUsersPermissions(idsOfUsers));
        for(PermissionSetAssignment psa : permissionSetsUsers){
            Boolean flag = false;
            if(permissionsToHandle.containsKey(psa.AssigneeId)){
                for(PermissionSetAssignment psu : permissionsToHandle.get(psa.AssigneeId)){
                    if(psu.PermissionSetId == this.permissionSetId) {flag = !flag; continue;}
                    permissionsToRemove.add(psu);
                }
            }
            permissionsToAdd.add(new PermissionSetAssignment(PermissionSetId = this.permissionSetId,AssigneeId = psa.AssigneeId));
        }
        try {
            Lib_Security.ws().dbDelete(new List<PermissionSetAssignment>(permissionsToRemove),false);
            Lib_Security.ws().dbInsert(new List<PermissionSetAssignment>(permissionsToAdd),false);   
        } catch (Exception e) {
            Integer indexOfRow = e.getMessage().indexOf('row');
            String indexRow = '';
            try {
                indexRow = e.getMessage().substring(indexOfRow + 4,indexOfRow + 6);
                indexOfRow = Integer.valueof(indexRow.trim());   
            } catch (Exception ex) {
                indexRow = e.getMessage().substring(indexOfRow + 4,indexOfRow + 5);
                indexOfRow = Integer.valueof(indexRow.trim());
            }
            this.errorMsg = this.errorMsg != null ? this.errorMsg + '\n' + permissionSetsUsers[indexOfRow].Assignee.Name + ' - ' + permissionSetsUsers[indexOfRow].Assignee.Profile.Name : '- ' + permissionSetsUsers[indexOfRow].Assignee.Name + ' ' + permissionSetsUsers[indexOfRow].Assignee.Profile.Name;
        }
    }
    public void finish(Database.BatchableContext BC){
        if(this.errorMsg == null || this.errorMsg.length() == 0) { return;}
        this.sendErrorEmail(this.errorMsg);
    }
    private String getPermissionSetLevel1(){
        return 'SELECT Id,Name FROM PermissionSet WHERE Name = \'WF_Recon_Level_1\'';
    } 
    private String getPermissionSetLevel2(){
        return 'SELECT Id,Name FROM PermissionSet WHERE Name = \'WF_Recon_Level_2\'';
    }
    private String getPermissionSetLevel3(){
        return 'SELECT Id,Name FROM PermissionSet WHERE Name = \'WF_Recon_Level_3\'';
    }
    private Boolean checkSecondLevelAccess(){
        return Util.secondLevelFeatureAccess();
    }
    private Boolean checkThirdLevelAccess(){
        return Util.thirdLevelFeatureAccess();
    }
    private void getPermissionSetId(){
        if(this.permissionSetId != null){ return;}
        if(this.checkSecondLevelAccess() && !this.checkThirdLevelAccess()){
            List<PermissionSet> secondLevelPermission = Lib_Security.ws().dbQuery(this.getPermissionSetLevel2(), new Object[]{});
            if(secondLevelPermission.size() > 0){
                this.permissionSetId = secondLevelPermission[0].Id;
            }
        }
        else if(this.checkThirdLevelAccess()){
            List<PermissionSet> thirdLevelPermission = Lib_Security.ws().dbQuery(this.getPermissionSetLevel3(), new Object[]{});
            if(thirdLevelPermission.size() > 0){
                this.permissionSetId = thirdLevelPermission[0].Id;
            }
        }
        else {
            List<PermissionSet> firstLevelPermission = Lib_Security.ws().dbQuery(this.getPermissionSetLevel1(), new Object[]{});
            if(firstLevelPermission.size() > 0){
                this.permissionSetId = firstLevelPermission[0].Id;
            }
        }
    }
    private void sendErrorEmail(String message){
        Messaging.SingleEmailMessage mail = new Messaging.SingleEmailMessage();
        String[] toAddresses = new String[] {UserInfo.getUserEmail()};
        mail.setToAddresses(toAddresses);
        mail.setSenderDisplayName('Work Force Recon Support');
        mail.setSubject('Error in Upgrading Features');
        mail.setPlainTextBody('The Change in Feature cannot be processed on the following users with these profiles :  \n ' + message ); 
        Messaging.sendEmail(new Messaging.SingleEmailMessage[] { mail });
    }
    private List<PermissionSetAssignment> checkUsersPermissions(List<Id> idListOfUsers){
        String query = 'SELECT Id,AssigneeId,PermissionSetId,Assignee.Name FROM PermissionSetAssignment WHERE PermissionSet.Name LIKE \'%WF_Recon%\' ' +
                        'AND Assignee.IsActive = TRUE ' +
                        'AND AssigneeId IN :arg1';
        return (List<PermissionSetAssignment>) Lib_Security.ws().dbQuery(query,new List<Object>{idListOfUsers});
    }
    private Map<Id,Set<PermissionSetAssignment>> convertListToMap(List<PermissionSetAssignment> permissionSetList){
        Map<Id,Set<PermissionSetAssignment>> mapOfPermissionsWithUsers = new Map<Id,Set<PermissionSetAssignment>>();
        for(PermissionSetAssignment psa : permissionSetList){
            if(mapOfPermissionsWithUsers.containsKey(psa.AssigneeId)){
                Set<PermissionSetAssignment> permissionsList = mapOfPermissionsWithUsers.get(psa.AssigneeId);
                permissionsList.add(psa);
                mapOfPermissionsWithUsers.put(psa.AssigneeId,permissionsList);

            }
            else{
                mapOfPermissionsWithUsers.put(psa.AssigneeId,new Set<PermissionSetAssignment>{psa});
            }
        }
        return mapOfPermissionsWithUsers;
    }
}