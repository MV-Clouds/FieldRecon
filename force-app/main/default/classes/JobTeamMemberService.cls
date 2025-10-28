public with sharing class JobTeamMemberService {
    public static List<JobTeamMemberMsg> getTeamMembersForJob(String jobId) {
        List<JobTeamMemberMsg> jobTeamMembers = new List<JobTeamMemberMsg>();
        Map<Id, Mobilization_Member__c> contactToMobMemberMap = new Map<Id, Mobilization_Member__c>();
        Map<Id, List<Timesheet__c>> contactToTimesheets = new Map<Id, List<Timesheet__c>>();
        List<Mobilization_Member__c> mobilizationMembers = Lib_Security.ws()
            .dbQuery(
                'SELECT Contact__c, Contact__r.Name, Contact__r.User__r.FullPhotoUrl FROM Mobilization_Member__c WHERE Mobilization__r.Job__c = :arg1 AND ((Contact__r.User__r.Crew_User__c = true AND Contact__r.User__r.IsActive = true AND Contact__r.RecordType.DeveloperName = \'Employee_WF_Recon\') OR (Contact__c != null AND Contact__r.RecordType.DeveloperName = \'Sub_Contractor_WF_Recon\' AND Contact__r.Can_Log_In_Out__c = TRUE))',
                new List<Object>{ jobId }
            );

        for (Mobilization_Member__c mobMember : mobilizationMembers) {
            contactToMobMemberMap.put(mobMember.Contact__c, mobMember);
        }

        List<Timesheet__c> existingTimesheets = Lib_Security.ws()
            .dbQuery(
                'SELECT Id, Time_Out__c, Time_In__c, Job__c, Contact__c, Contact__r.User__r.Name, Contact__r.User__r.FullPhotoUrl FROM Timesheet__c WHERE Contact__c IN :arg1 AND Timesheet_Start_Date__c <= TODAY AND Timesheet_End_Date__c >= TODAY ORDER BY Time_In__c DESC ',
                new List<Object>{ contactToMobMemberMap.keySet() }
            );

        for (Timesheet__c timesheet : existingTimesheets) {
            if (contactToTimesheets.containsKey(timesheet.Contact__c)) {
                contactToTimesheets.get(timesheet.Contact__c).add(timesheet);
            } else {
                contactToTimesheets.put(timesheet.Contact__c, new List<Timesheet__c>{ timesheet });
            }
        }

        //Go through all Mobilization Members for this Job
        for (Id contactId : contactToMobMemberMap.keySet()) {
            Mobilization_Member__c mobMember = contactToMobMemberMap.get(contactId);
            JobTeamMemberMsg teamMember = new JobTeamMemberMsg();

            teamMember.name = mobMember.Contact__r.Name;
            teamMember.profileUrl = mobMember.Contact__r.User__r.FullPhotoUrl;

            //If they have other timesheets
            if (contactToTimesheets.containsKey(contactId)) {
                for (Timesheet__c timesheet : contactToTimesheets.get(contactId)) {
                    if (timesheet.Time_In__c != null && (timesheet.Time_Out__c == null || timesheet.Time_Out__c <= timesheet.Time_In__c )) {
                        if (timesheet.Job__c == jobId) {
                            teamMember.status = Constants.CLOCKED_IN;
                            break;
                        } else {
                            teamMember.status = Constants.CLOCKED_IN_ANOTHER;
                            break;
                        }
                    } else {
                        teamMember.status = Constants.CLOCKED_OUT;
                        break;
                    }
                }
            } else {
                teamMember.status = Constants.CLOCKED_OUT;
            }
            jobTeamMembers.add(teamMember);
        }
        return jobTeamMembers;
    }
}