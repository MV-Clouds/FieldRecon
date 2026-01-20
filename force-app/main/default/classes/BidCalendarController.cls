public with sharing class BidCalendarController {
    
    private static final String CLASSNAME = 'BidCalendarController';
    
    // ==============================
    // Event Fetching for FullCalendar
    // ==============================
    @AuraEnabled
    public static List<Map<String, Object>> getEvents(Id bidId, List<String> status) {
        try {
            // Map<String, Object> permissionMap = PermissionsUtility.checkPermissionSetsAssigned(new List<String>{'FR_Mobilization_Calendar'});
            // Boolean isAdmin = (Boolean) permissionMap.get('isAdmin');
            // Boolean isCalendarPS = (Boolean) permissionMap.get('all');

            String baseQuery = 'SELECT Id, Name, wfrecon__AccountId__c, wfrecon__AccountId__r.Name, wfrecon__Status__c, wfrecon__Description__c, wfrecon__Amount__c, wfrecon__Bid_Due_Date__c, ' +
                       'wfrecon__Contact__c, wfrecon__Contact__r.Name, wfrecon__Job__c, wfrecon__Job__r.Name, wfrecon__Job__r.wfrecon__Job_Name__c, wfrecon__Job__r.wfrecon__Address__c ' +
                       'FROM wfrecon__Bid__c ';

            // List to hold dynamic filters
            List<String> filters = new List<String>();
            if (bidId != null) {
                filters.add('Id = :bidId');
            }
            if (status != null && status.size() > 0) {
                filters.add('wfrecon__Status__c  IN :status');
            }
        
            // Combine filters into the query
            if (!filters.isEmpty()) {
                baseQuery += ' WHERE ' + String.join(filters, ' AND ');
            }

            // Execute dynamic query
            List<wfrecon__Bid__c> bids = Database.query(baseQuery);

            // Fetch all custom setting records for status colors
            // Map<String, wfrecon__Mobilization_Status_Color__c> colorMap = wfrecon__Mobilization_Status_Color__c.getAll();

            List<Map<String, Object>> result = new List<Map<String, Object>>();
            for (wfrecon__Bid__c bid : bids) {

                Map<String, Object> ev = new Map<String, Object>();
                ev.put('id', bid.Id);
                ev.put('title', bid.Name + ' - ' + bid.wfrecon__Status__c);
                ev.put('start', bid.wfrecon__Bid_Due_Date__c);
                ev.put('end', bid.wfrecon__Bid_Due_Date__c);
                ev.put('jobId', bid.wfrecon__Job__c);
                ev.put('allDay', true);
                ev.put('desc',bid.wfrecon__Description__c);

                if (bid.wfrecon__Job__r?.wfrecon__Address__c != null) {
                    ev.put('jobLocation', bid.wfrecon__Job__r.wfrecon__Address__c);
                }

                if (bid.wfrecon__Status__c != null) {
                    ev.put('status', bid.wfrecon__Status__c);

                    String bgColor = '#9b9bff'; // default
                    String textColor = '#020203';

                    switch on bid.wfrecon__Status__c {
                        when 'Prospecting' {
                            bgColor = '#7B8CFF';
                        }
                        when 'Qualification' {
                            bgColor = '#4FC3F7';
                        }
                        when 'No Bid' {
                            bgColor = '#B0BEC5';
                        }
                        when 'Bidding' {
                            bgColor = '#FFB74D';
                        }
                        when 'Closed Won' {
                            bgColor = '#66BB6A';
                        }
                        when 'Closed Lost' {
                            bgColor = '#EF5350';
                        }
                        when else {
                            bgColor = '#9b9bff'; // fallback
                        }
                    }

                    ev.put('backgroundColor', bgColor);
                    ev.put('textColor', textColor);
                }


                result.add(ev);
            }
            return result;

        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{ 'className' => CLASSNAME, 'methodName' => 'getEvents', 'isApiException' => false, 'statusCode' => null, 'exceptionObj' => e, 'moreDetails' => e.getMessage(), 'apiResponse' => null}); return new List<Map<String, Object>>();
        }
    }

    // ==============================
    // Delete Bid
    // ==============================
    @AuraEnabled
    public static void deleteBid(Id recordId){
        List<wfrecon__Bid__c> bids = [
            SELECT Id FROM wfrecon__Bid__c WHERE Id = :recordId
        ];
        if (!bids.isEmpty()) {
            delete bids;
        }
    }

    @AuraEnabled
    public static List<Map<String,String>> getBidStatusOptions(){
        List<Map<String,String>> result = new List<Map<String,String>>();
        try {
            Schema.DescribeFieldResult fieldResult = wfrecon__Bid__c.wfrecon__Status__c.getDescribe();
            List<Schema.PicklistEntry> ple = fieldResult.getPicklistValues();
            for( Schema.PicklistEntry f : ple){
                result.add(new Map<String,String>{'label' => f.getLabel(), 'value' => f.getValue()});
            }
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{ 'className' => CLASSNAME, 'methodName' => 'getBidStatusOptions', 'isApiException' => false, 'statusCode' => null, 'exceptionObj' => e, 'moreDetails' => e.getMessage(), 'apiResponse' => null}); return null;
        }
        return result;
    }

    // ==============================
    // Utility Methods
    // ==============================
    private static Datetime updateDateFromTime(Time target, Datetime source) {
        return Datetime.newInstance(
            source.year(), source.month(), source.day(),
            target.hour(), target.minute(), target.second()
        );
    }

    @AuraEnabled
    public static Decimal getTimeZoneOffset(){
        Decimal offsetHours = 0;
        try {
            TimeZone userTimeZone = UserInfo.getTimeZone();
            DateTime currentTime = DateTime.now();
            Integer offsetMilliseconds = userTimeZone.getOffset(currentTime);
            offsetHours = (Decimal)offsetMilliseconds / (1000 * 60 * 60);
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{ 'className' => CLASSNAME, 'methodName' => 'getTimeZoneOffset', 'isApiException' => false, 'statusCode' => null, 'exceptionObj' => e, 'moreDetails' => e.getMessage(), 'apiResponse' => null });
        }
        return offsetHours;
    }

    @AuraEnabled
    public static String SaveBidRecord(Map<String, String> bidMap) {

        try{
            wfrecon__Bid__c bid = new wfrecon__Bid__c(
                Id = bidMap.get('id'),
                wfrecon__Bid_Due_Date__c = Date.valueOf(bidMap.get('dueDate')),
                wfrecon__Job__c = bidMap.get('job'),
                wfrecon__Status__c = bidMap.get('status'),
                wfrecon__Description__c = bidMap.get('description')
            );
            upsert bid;
            return 'SUCCESS';
        }catch(Exception e){
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME , 'methodName' => 'SaveBidRecord', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});
            return null;
        }        
    }

    @AuraEnabled
    public static BidWrapper getBid(Id recordId){
        List<wfrecon__Bid__c> bids = [SELECT Id, wfrecon__Description__c,Name, wfrecon__Job__c,wfrecon__Job__r.wfrecon__Job_Name__c,wfrecon__Job__r.Name, wfrecon__Bid_Due_Date__c, wfrecon__Status__c,toLabel(wfrecon__Status__c) bidStatus FROM wfrecon__Bid__c WHERE Id = :recordId LIMIT 1];
        return new BidWrapper(bids[0]);
    }   

    public class DefaultTimeWrapper {
        @AuraEnabled public DateTime startDateTime { get; set; }
        @AuraEnabled public DateTime endDateTime{ get; set; }
        @AuraEnabled public Boolean IncludeSaturday { get; set; }
        @AuraEnabled public Boolean IncludeSunday { get; set; }
    }

    public class BidWrapper {
        @AuraEnabled
        public String id{get;set;}
        @AuraEnabled
        public String name{get;set;}
        @AuraEnabled
        public Date dueDate{get;set;}
        @AuraEnabled
        public String jobId{get;set;}
        @AuraEnabled
        public String jobName{get;set;}
        @AuraEnabled
        public String description{get;set;}
        @AuraEnabled
        public String jobRealName{get;set;}
        @AuraEnabled
        public String status{get;set;}

        public BidWrapper() {}

        public BidWrapper(wfrecon__Bid__c bid) {
            this.id = bid.Id;
            this.name = bid.Name;
            this.dueDate = bid.wfrecon__Bid_Due_Date__c;
            this.jobId = bid.wfrecon__Job__c;
            this.jobRealName = bid.wfrecon__Job__r?.wfrecon__Job_Name__c;
            this.jobName = bid.wfrecon__Job__r?.Name;
            this.status = bid.wfrecon__Status__c;
            this.description = bid.wfrecon__Description__c;
        }

        public wfrecon__Bid__c getBidSObject() {
            return new wfrecon__Bid__c(
                Id = this.id,
                wfrecon__Bid_Due_Date__c = this.dueDate,
                wfrecon__Job__c = this.jobId,
                wfrecon__Status__c = this.status,
                wfrecon__Description__c = this.description
            );
        }
    }
}