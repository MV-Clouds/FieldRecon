public with sharing class JobController {
    @AuraEnabled
    public static List<JobController.MarkerWrapper> getGeneralMarkers() {
        List<JobController.MarkerWrapper> markerList = new List<JobController.MarkerWrapper>();
            String soql = 'SELECT Count(Id) jobCount, State__c, Country__c FROM Job__c WITH SECURITY_ENFORCED'+
                        ' GROUP BY State__c, Country__c LIMIT 50000';
            
            List<AggregateResult> AggregateResultList = Lib_Security.ws().dbAggreQuery(soql, new Object[]{});
            if (!AggregateResultList.isEmpty()) {
                for (AggregateResult ar : AggregateResultList) {
                    JobController.MarkerWrapper mw = new JobController.MarkerWrapper();

                    String title = '(' + String.valueOf((Integer) ar.get('jobCount')) + ' jobs) ';
                    title = ar.get(Util.getNamespaceWithUnderscore() + 'State__c') != null
                        ? title + (String) ar.get(Util.getNamespaceWithUnderscore() + 'State__c')
                        : title;
                    title = ar.get(Util.getNamespaceWithUnderscore() + 'State__c') != null &&
                        ar.get(Util.getNamespaceWithUnderscore() + 'Country__c') != null
                        ? title + ', '
                        : title;
                    title = ar.get(Util.getNamespaceWithUnderscore() + 'Country__c') != null
                        ? title + (String) ar.get(Util.getNamespaceWithUnderscore() + 'Country__c')
                        : title;

                    mw.title = title;
                    mw.location = new JobController.LocationWrapper(
                        (String) ar.get(Util.getNamespaceWithUnderscore() + 'State__c'),
                        (String) ar.get(Util.getNamespaceWithUnderscore() + 'Country__c')
                    );

                    markerList.add(mw);
                }
            }

            return markerList;
    }

    @AuraEnabled
    public static String getNamespace(){
        try {
            return Util.getNamespaceWithUnderscore();
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    @AuraEnabled
    public static List<JobController.MarkerWrapper> getJobMarkers(
        String searchType,
        Double latValue,
        Double longValue,
        String stateName
    ) {
            String query =
                'SELECT Id, Name, Job_Name__c, Street__c, City__c, State__c, Country__c, Zip_Code__c, Geocode__Latitude__s, Geocode__Longitude__s ' +
                ' FROM Job__c ';
            Set<Id> accountIds = new Set<Id>();
            if (searchType == 'nearby') {
                query =
                    query +
                    ' WHERE DISTANCE(Geocode__c, GEOLOCATION(' +
                    String.escapeSingleQuotes(String.valueOf(latValue)) +
                    ',' +
                    String.escapeSingleQuotes(String.valueOf(longValue)) +
                    '), \'mi\') < 25 ' +
                    ' ORDER BY Name LIMIT 50 ';
                    System.debug(query);
            }
            else if (searchType == 'update') {
                query = query + ' WHERE LastModifiedDate = LAST_N_DAYS:7 WITH SECURITY_ENFORCED ORDER BY Name LIMIT 50 ';
            } else if (searchType == 'view') {
                
                String rvQuery = 'SELECT Id, Name, Type, LastViewedDate FROM RecentlyViewed '+
                                'WHERE LastViewedDate != null AND Type = \'job__c\' WITH SECURITY_ENFORCED '+
                                ' ORDER BY LastViewedDate DESC';
                
                for(RecentlyViewed rv : (RecentlyViewed[])Lib_Security.ws().dbQuery(rvQuery, new Object[]{})) {
                    accountIds.add(rv.Id);
                }

                query = query + ' WHERE Id IN :arg1 WITH SECURITY_ENFORCED';
            } else if (searchType == 'state') {
                query = query + ' WHERE State__c ='+String.escapeSingleQuotes(':arg2')+' WITH SECURITY_ENFORCED ORDER BY Name LIMIT 50 ';
            }
            List<Job__c> jobList = new List<Job__c>();
            jobList = Lib_Security.ws().dbQuery(query, new Object[]{accountIds,stateName});
            List<JobController.MarkerWrapper> markerList = new List<JobController.MarkerWrapper>();

            for (Job__c j : jobList)
                markerList.add(new JobController.MarkerWrapper(j));

            return markerList;
    }

    public class MarkerWrapper {
        @AuraEnabled
        public String icon;
        @AuraEnabled
        public String title;
        @AuraEnabled
        public String description;
        @AuraEnabled
        public JobController.LocationWrapper location;

        public MarkerWrapper() {
            this.icon = 'utility:location';
        }

        public MarkerWrapper(Job__c job) {
            this.icon = 'standard:location';
            this.title = job.Job_Name__c;

            this.description =
                ' <a href="' +
                URL.getSalesforceBaseUrl().toExternalForm() +
                '/' +
                job.Id +
                '" target="_blank">' +
                job.Name +
                ' : ' +
                job.Job_Name__c +
                '</a>';

            this.location = new JobController.LocationWrapper(job);
        }
    }

    public class LocationWrapper {
        @AuraEnabled
        public String Street;
        @AuraEnabled
        public String City;
        @AuraEnabled
        public String PostalCode;
        @AuraEnabled
        public String State;
        @AuraEnabled
        public String Country;
        @AuraEnabled
        public String Latitude;
        @AuraEnabled
        public String Longitude;

        public LocationWrapper(String stateName, String countryName) {
            this.State = stateName;
            this.Country = countryName;
        }

        public LocationWrapper(Job__c job) {
            this.Latitude = String.valueOf(job.Geocode__Latitude__s);
            this.Longitude = String.valueOf(job.Geocode__Longitude__s);
            this.Street = job.Street__c;
            this.City = job.City__c;
            this.PostalCode = job.Zip_Code__c;
            this.State = job.State__c;
            this.Country = job.Country__c;
        }
    }
}