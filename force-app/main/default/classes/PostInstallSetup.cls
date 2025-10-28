/*
    This class is without sharing because this class
    schedules a job, that should not take into 
    consideration user's permissions.
*/
global class PostInstallSetup implements InstallHandler {
    public void onInstall(InstallContext context){
        //String soqlForSchd = 'SELECT Id FROM CronJobDetail WHERE Name = \'FeatureJobSchd\'';
        String soqlForSchdMerge = 'SELECT Id FROM CronJobDetail WHERE Name = \'Merge Job\'';
        String soqlForPermSet = 'SELECT Id,PermissionSetId,AssigneeId FROM PermissionSetAssignment WHERE PermissionSet.Name LIKE \'%WF_Recon%\' AND AssigneeId = :arg1';
        String soqlFirstLevelPerm = 'SELECT Id,Name FROM PermissionSet WHERE Name = \'WF_Recon_Level_1\'';
        //List<CronJobDetail> schdJobs = Lib_Security.is().dbQuery(soqlForSchd, new Object[]{});
        List<CronJobDetail> schdJobsMerge = Lib_Security.is().dbQuery(soqlForSchdMerge, new Object[]{});
        List<PermissionSetAssignment> permAssignes = Lib_Security.is().dbQuery(soqlForPermSet, new Object[]{context.installerID()});
        List<PermissionSet> firstLevelSet = Lib_Security.is().dbQuery(soqlFirstLevelPerm, new Object[]{});
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
    }
}