public with sharing class JobTeamMembersController {
    public static String CLOCK_IN = 'Clocked In';
    public static String CLOCK_OUT = 'Clocked Out';
    public static String CLOCK_IN_ANOTHER = 'Clocked in on another job';

    @AuraEnabled
    public static String getJobTeamMembers(String jobId) {
        try {
            if(!Util.secondLevelFeatureAccess() && !Util.thirdLevelFeatureAccess()){
                throw new HandledException('Second Level Feature not Enabled!');
            }
            return JSON.serialize(JobTeamMemberService.getTeamMembersForJob(jobId));
        } catch (Exception e) {
            System.debug('exception here: ' + e.getMessage());
            throw new AuraHandledException(e.getMessage());
        }
    }
}