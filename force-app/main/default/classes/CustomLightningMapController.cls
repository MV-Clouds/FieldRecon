public with sharing class CustomLightningMapController {
    @AuraEnabled
    public static list<locationDetailWrapper> getDefaults(String JobId) {
        list<locationDetailWrapper> lstALW = new List<locationDetailWrapper>();
        List<Job__c> joblist = new List<Job__c>();
        String job = 'SELECT Id, Street__c, Zip_Code__c, City__c, State__c, Country__c, Geocode__longitude__s, Geocode__latitude__s, Description__c ';
        job += ' FROM Job__c WHERE Id =:arg1 ';

        joblist = Lib_Security.ws().dbQuery(job, new List<Object>{ JobId });
        for (Job__c fm : joblist) {
            lstALW.add(
                new locationDetailWrapper(
                    fm.Street__c,
                    fm.Zip_Code__c,
                    fm.City__c,
                    fm.State__c,
                    fm.Country__c,
                    fm.Geocode__longitude__s,
                    fm.Geocode__latitude__s,
                    fm.Description__c
                )
            );
        }
        return lstALW;
    }

    public class LocationDetailWrapper {
        @AuraEnabled
        public string Street { get; set; }
        @AuraEnabled
        public string PostalCode { get; set; }
        @AuraEnabled
        public string City { get; set; }
        @AuraEnabled
        public string State { get; set; }
        @AuraEnabled
        public string Country { get; set; }
        @AuraEnabled
        public decimal longitude { get; set; }
        @AuraEnabled
        public decimal latitude { get; set; }
        @AuraEnabled
        public String title { get; set; }

        public LocationDetailWrapper(
            String Street,
            String PostalCode,
            String City,
            String State,
            String Country,
            decimal longitude,
            decimal latitude,
            String title
        ) {
            this.Street = Street;
            this.PostalCode = PostalCode;
            this.City = City;
            this.State = State;
            this.Country = Country;
            this.longitude = longitude;
            this.latitude = latitude;
            this.title = title;
        }
    }
}