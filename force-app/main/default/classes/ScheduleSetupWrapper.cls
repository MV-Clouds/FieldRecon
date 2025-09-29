public with sharing class ScheduleSetupWrapper {
    @AuraEnabled
    public List<ColorStatusWrapper> mobilizationStatuses { get; set; }
    @AuraEnabled
    public List<ColorStatusWrapper> assetTypes { get; set; }
    @AuraEnabled
    public String startTime { get; set; }
    @AuraEnabled
    public String endTime { get; set; }
}