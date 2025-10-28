public with sharing class ColorStatusWrapper {
    @AuraEnabled
    public String status { get; set; }
    @AuraEnabled
    public String backgroundColor { get; set; }
    @AuraEnabled
    public String textColor { get; set; }
    @AuraEnabled
    public String settingId { get; set; }

    public ColorStatusWrapper() {
        status = '';
        backgroundColor = '';
        textColor = '';
    }
}