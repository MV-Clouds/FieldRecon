public with sharing class BatchAccountGeofieldUpdate implements Database.Batchable<sObject>, Database.AllowsCallouts, Database.Stateful {
    //Array for storing all the error response from execute method
    Exception[] errors = new List<Exception>(0);
    public Database.QueryLocator start(Database.BatchableContext BC) {
        //query on Task
        String query = 'SELECT id,Street__c,City__c,Country__c,Zip_Code__c,State__c, Geocode__Latitude__s, Geocode__Longitude__s FROM Job__c where Geocode__Latitude__s = NULL';
        return Database.getQueryLocator(query);
    }

    public void execute(Database.BatchableContext BC, List<Job__c> Accountupdate) {
        List<Job__c> modifiedAccounts = new List<Job__c>();
        for (Job__c a : Accountupdate) {
            String address = '';
            if (a.Street__c != null)
                address += a.Street__c + ', ';
            if (a.City__c != null)
                address += a.City__c + ', ';
            if (a.State__c != null)
                address += a.State__c + ' ';
            if (a.Zip_Code__c != null)
                address += a.Zip_Code__c + ', ';
            if (a.Country__c != null)
                address += a.Country__c;
            address = EncodingUtil.urlEncode(address, 'UTF-8');
            try {
                System.debug(address);
                SYstem.debug(a);
                google gro = callGoogleApex(address);
                if (gro.results.size() > 0) {
                    double lat = gro.results[0].geometry.location.lat;
                    double lon = gro.results[0].geometry.location.lng;

                    if (lat != null) {
                        a.Geocode__Latitude__s = lat;
                        a.Geocode__Longitude__s = lon;
                        modifiedAccounts.add(a);
                    }
                }
            } catch (Exception e) {
                //adding the exception to the array
                errors.add(e);
            }
        }
        try {
            Lib_Security.ws().dbUpdate(modifiedAccounts);
        } catch (Exception e) {
            errors.add(e);
        }
    }
    public static wfrecon__Google_API__c googleKey{
        get{
            if(googleKey != NULL) { return googleKey;}
            List<wfrecon__Google_API__c> getKey = wfrecon__Google_API__c.getAll().values();
            if(getKey.isEmpty()){
                getKey.add(new wfrecon__Google_API__c(Name = 'Google API' ,wfrecon__API_Key__c ='AIzaSyDfyrfb13gyPy1Oh3mf0X6BgqbWDPRSbnc'));
            }
            googleKey = getKey[0];
            return googleKey;
        }set;
    }
    public static google callGoogleApex(string address) {
        Http h = new Http();
        HttpRequest req = new HttpRequest();
        google gro = new google();
        //AIzaSyDIJ9XX2ZvRKCJcFRrl-lRanEtFUow4piM => new
        //AIzaSyCK368C3-NvR-53jHNRi4Cglexbl_mkbI8 => old
        //String geocodingKey = 'AIzaSyC5Z3twwN_hX_uP1JrDnY_726nH26Zb058';
        String geocodingKey = googleKey.wfrecon__API_Key__c;
        if (address != null) {
            req.setEndpoint(
                'https://maps.googleapis.com/maps/api/geocode/json?address=' +
                address +
                '&key=' +
                geocodingKey +
                '&sensor=false'
            );
            req.setMethod('GET');
            req.setTimeout(6000);

            HttpResponse res = h.send(req);
            System.debug(res.getBody());
            JSONParser parser = JSON.createParser(res.getBody());
            while (parser.nextToken() != null) {
                if (parser.getCurrentToken() == JSONToken.START_OBJECT) {
                    gro = (google) parser.readValueAs(google.class);
                }
            }
        }
        return gro;
    }
    public void finish(Database.BatchableContext BC) {
        if(googleKey != null && wfrecon__Google_API__c.getAll().values().isEmpty()){
            INSERT googleKey;
        }
        //sending the error response to the logged in user if there will be some errors while
        //running the batch
        if (!errors.isEmpty()) {
            AsyncApexJob a = [
                SELECT Id, Status, ExtendedStatus, NumberOfErrors, JobItemsProcessed, TotalJobItems, CreatedBy.Email
                FROM AsyncApexJob
                WHERE Id = :BC.getJobId()
            ];
            String errorMessages = '';
            for (Exception e : errors) {
                errorMessages += 'Message =' + e.getMessage() + '-------';
            }
            Messaging.SingleEmailMessage mail = new Messaging.SingleEmailMessage();
            String[] toAddresses = new List<String>{ UserInfo.getUserEmail() };
            mail.setToAddresses(toAddresses);
            mail.setSubject('Match Merge Batch ' + a.Status);
            mail.setPlainTextBody(
                'records processed ' +
                a.TotalJobItems +
                'with ' +
                a.NumberOfErrors +
                ' failures. ' +
                errorMessages
            );
            Messaging.sendEmail(new List<Messaging.SingleEmailMessage>{ mail });
        }
    }
}