public with sharing class ScheduleFeatureTabController {
    public ScheduleFeatureTabController() {}
    
    public PageReference scheduleJob(){
        FeatureJob fj = new FeatureJob();
        String sch = '0 0 0,12 ? * *';
        String jobID = System.schedule('FeatureJobSchd', sch, fj);
        checkFeatureJobStatus = true;
        return null;
    }
    public Boolean checkFeatureJobStatus{
        get{
            if(checkFeatureJobStatus != null) {return checkFeatureJobStatus;}
            String soqlForSchd = 'SELECT Id FROM CronJobDetail WHERE Name = \'FeatureJobSchd\'';
            List<CronJobDetail> schdJobs = Lib_Security.is().dbQuery(soqlForSchd, new Object[]{});
            if(schdJobs.size() == 0) { 
                checkFeatureJobStatus = false;
            }
            else {
                checkFeatureJobStatus = true; 
            }
            return checkFeatureJobStatus;
        } set;
    }
}