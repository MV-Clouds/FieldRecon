public with sharing class JobTeamMemberMsg {
    @AuraEnabled
    public String name;
    public String status;
    public string profileUrl;

    public JobTeamMemberMsg() {
    }
}