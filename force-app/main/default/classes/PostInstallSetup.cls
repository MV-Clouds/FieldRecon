/*
    This class is without sharing because this class
    schedules a job, that should not take into 
    consideration user's permissions.
*/
global class PostInstallSetup implements InstallHandler {
    public void onInstall(InstallContext context){
        try {

            //String soqlForSchd = 'SELECT Id FROM CronJobDetail WHERE Name = \'FeatureJobSchd\'';
            String soqlForSchdMerge = 'SELECT Id FROM CronJobDetail WHERE Name = \'Merge Job\'';
            String soqlForPermSet = 'SELECT Id,PermissionSetId,AssigneeId FROM PermissionSetAssignment WHERE PermissionSet.Name LIKE \'%WF_Recon%\' AND AssigneeId = :arg1';
            String soqlFirstLevelPerm = 'SELECT Id,Name FROM PermissionSet WHERE Name = \'WF_Recon_Level_1\'';
            //List<CronJobDetail> schdJobs = Lib_Security.is().dbQuery(soqlForSchd, new Object[]{});
            List<CronJobDetail> schdJobsMerge = Lib_Security.is().dbQuery(soqlForSchdMerge, new Object[]{});
            List<PermissionSetAssignment> permAssignes = Lib_Security.is().dbQuery(soqlForPermSet, new Object[]{context.installerID()});
            List<PermissionSet> firstLevelSet = Lib_Security.is().dbQuery(soqlFirstLevelPerm, new Object[]{});
            
            // Assign FR_Base to all users and FR_Admin to installer
            assignPermissionSets(context.installerID());
            
            if(permAssignes.size() > 0 && schdJobsMerge.size() > 0){ return;}
            if(permAssignes.size() == 0 && firstLevelSet.size() >0){
                PermissionSetAssignment psa = new PermissionSetAssignment(AssigneeId = context.installerID(),PermissionSetId = firstLevelSet[0].Id);
                Lib_Security.is().dbInsert(new PermissionSetAssignment[]{psa});
            }
            /*if(schdJobs.size() == 0){
                FeatureJob fj = new FeatureJob();
                String sch = '0 0 0,12 ? * *';
                String jobID = System.schedule('FeatureJobSchd', sch, fj); 
            }*/
            if(schdJobsMerge.size() == 0){
                BatchSchdAccountGeofieldUpdate m = new BatchSchdAccountGeofieldUpdate();
                String sch = '00 00 00 ? * * *';
                String jobID = System.schedule('Merge Job', sch, m);
            }

            // Query all PermissionSetTabSetting records for the specified tabs and profiles
            List<PermissionSetTabSetting> tabVisibilities = [
                SELECT Id, Name, Visibility, Parent.Profile.Name 
                FROM PermissionSetTabSetting 
                WHERE Name IN ('wfrecon__NewMobilizationCalendar', 
                               'wfrecon__Mobilization_Scheduler', 
                               'wfrecon__Time_Log_Manager', 
                               'wfrecon__Management', 
                               'wfrecon__Time_Card')
                AND Parent.Profile.Name != null
            ];

            if (!tabVisibilities.isEmpty()) {
                delete tabVisibilities;
            }

        } catch (Exception e) {
            System.debug('Post install error: ' + e.getMessage());
        }
    }
    
    // Helper method to assign permission sets
    private void assignPermissionSets(Id installerId) {
        try {
            // Fetch FR_Base and FR_Admin permission sets
            Map<String, Id> permSetMap = new Map<String, Id>();
            for (PermissionSet ps : [
                SELECT Id, Name 
                FROM PermissionSet 
                WHERE Name IN ('FR_Base', 'FR_Admin')
            ]) {
                permSetMap.put(ps.Name, ps.Id);
            }

            Id frBaseId = permSetMap.get('FR_Base');
            Id frAdminId = permSetMap.get('FR_Admin');

            if (frBaseId == null && frAdminId == null) {
                System.debug('No matching permission sets found.');
                return;
            }

            // Query existing assignments to avoid duplicates
            Set<Id> permSetIds = new Set<Id>();
            if (frBaseId != null) permSetIds.add(frBaseId);
            if (frAdminId != null) permSetIds.add(frAdminId);

            Map<Id, Set<Id>> userToAssignedPerms = new Map<Id, Set<Id>>();
            for (PermissionSetAssignment psa : [
                SELECT AssigneeId, PermissionSetId 
                FROM PermissionSetAssignment 
                WHERE PermissionSetId IN :permSetIds
            ]) {
                if (!userToAssignedPerms.containsKey(psa.AssigneeId)) {
                    userToAssignedPerms.put(psa.AssigneeId, new Set<Id>());
                }
                userToAssignedPerms.get(psa.AssigneeId).add(psa.PermissionSetId);
            }

            List<PermissionSetAssignment> toInsert = new List<PermissionSetAssignment>();

            // Assign FR_Base to all active users
            if (frBaseId != null) {
                for (User u : [SELECT Id FROM User WHERE IsActive = true]) {
                    if (!userToAssignedPerms.containsKey(u.Id) ||
                        !userToAssignedPerms.get(u.Id).contains(frBaseId)) {
                        toInsert.add(new PermissionSetAssignment(
                            AssigneeId = u.Id,
                            PermissionSetId = frBaseId
                        ));
                    }
                }
            }

            // Assign FR_Admin to installer only
            if (frAdminId != null &&
                (!userToAssignedPerms.containsKey(installerId) ||
                !userToAssignedPerms.get(installerId).contains(frAdminId))) {
                toInsert.add(new PermissionSetAssignment(
                    AssigneeId = installerId,
                    PermissionSetId = frAdminId
                ));
            }

            if (!toInsert.isEmpty() && !Test.isRunningTest()) {
                Database.executeBatch(new BatchAssignPermissionSets(toInsert), 1);
            }

        } catch (Exception e) {
            System.debug('Error in PostInstallScript: ' + e.getMessage());
            String errorDetails = 
                '--- Context ---\n' +
                'Org Id: ' + UserInfo.getOrganizationId() + '\n' +
                'User Id (Running): ' + UserInfo.getUserId() + '\n' +
                '\n--- Error ---\n' +
                'Message: ' + e.getMessage() + '\n' +
                'Type: ' + e.getTypeName() + '\n' +
                'Line: ' + String.valueOf(e.getLineNumber()) + '\n' +
                'Stack Trace:\n' + e.getStackTraceString();
            
            sendErrorEmail('PostInstallSetup Exception', errorDetails);
        }
    }
    
    // Generic method to send error emails
    private void sendErrorEmail(String subject, String errorDetails) {
        try {
            Messaging.SingleEmailMessage mail = new Messaging.SingleEmailMessage();
            mail.setToAddresses(new String[] { 'fieldrecon@mvclouds.com' });
            mail.setSubject(subject + ' - ' + String.valueOf(Datetime.now()));
            
            String body =
                'An error occurred during package post-install.\n\n' +
                errorDetails;
            
            mail.setPlainTextBody(body);
            mail.setSaveAsActivity(false);
            Messaging.sendEmail(new Messaging.SingleEmailMessage[] { mail }, false);
        } catch (Exception emailEx) {
            System.debug('Failed to send error email: ' + emailEx.getMessage());
        }
    }

    
}