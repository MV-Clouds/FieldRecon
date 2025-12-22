public with sharing class NewMobilizationCalendarController {
    private static final String CLASSNAME = 'NewMobilizationCalendarController';
        // ==============================
        // Event Fetching for FullCalendar
        // ==============================
    @AuraEnabled
    public static List<Map<String, Object>> getEvents(Id job, List<String> status) {
        try {
            Map<String, Object> permissionMap = PermissionsUtility.checkPermissionSetsAssigned(new List<String>{'FR_Mobilization_Calendar'});
            Boolean isAdmin = (Boolean) permissionMap.get('isAdmin');
            Boolean isCalendarPS = (Boolean) permissionMap.get('all');

            String baseQuery = 'SELECT Id, Name, wfrecon__Start_Date__c, wfrecon__End_Date__c, wfrecon__Mobilization_Status__c, wfrecon__Description__c, wfrecon__Include_Sunday__c, wfrecon__Include_Saturday__c, ' +
                       'wfrecon__Job__c, wfrecon__Job__r.wfrecon__Job_Name__c, wfrecon__Job__r.Name, wfrecon__Job__r.wfrecon__Address__c ' +
                       'FROM wfrecon__Mobilization_Group__c ';

            // List to hold dynamic filters
            List<String> filters = new List<String>();
            if (job != null) {
                filters.add('wfrecon__Job__c = :job');
            }
            if (status != null && status.size() > 0) {
                filters.add('wfrecon__Mobilization_Status__c  IN :status');
            }else{
                filters.add('wfrecon__Mobilization_Status__c != \'Overhead Job\'');
            }
            if(!isAdmin && !isCalendarPS){
                List<wfrecon__Mobilization_Member__c> mobGroupMap = [SELECT wfrecon__Mobilization__r.wfrecon__Mobilization_Group__c FROM wfrecon__Mobilization_Member__c WHERE wfrecon__Contact__r.wfrecon__User__c =: UserInfo.getUserId() WITH USER_MODE];
                Set<Id> mobGroupIds = new Set<Id>();
                for(wfrecon__Mobilization_Member__c mobGroup : mobGroupMap){
                    mobGroupIds.add(mobGroup.wfrecon__Mobilization__r.wfrecon__Mobilization_Group__c);
                }
                if(!mobGroupIds.isEmpty()){
                    filters.add('Id IN :mobGroupIds');
                }
            }
        
            // Combine filters into the query
            if (!filters.isEmpty()) {
                baseQuery += ' WHERE ' + String.join(filters, ' AND ');
            }

            // Execute dynamic query
            List<wfrecon__Mobilization_Group__c> mobGroups = Database.query(baseQuery);

            // Fetch all custom setting records for status colors
            Map<String, wfrecon__Mobilization_Status_Color__c> colorMap = wfrecon__Mobilization_Status_Color__c.getAll();

            List<Map<String, Object>> result = new List<Map<String, Object>>();
            for (wfrecon__Mobilization_Group__c mob : mobGroups) {

                Map<String, Object> ev = new Map<String, Object>();
                ev.put('id', mob.Id);
                ev.put('title', mob.wfrecon__Job__r.wfrecon__Job_Name__c + ' - ' + mob.wfrecon__Job__r.Name);
                ev.put('start', mob.wfrecon__Start_Date__c?.format('MM/dd/yyyy, h:mm a'));
                ev.put('timestart', mob.wfrecon__Start_Date__c.format('hh:mm a'));
                ev.put('timeend', mob.wfrecon__End_Date__c.format('hh:mm a'));
                ev.put('end', mob.wfrecon__End_Date__c?.addDays(1)?.format('MM/dd/yyyy, h:mm a'));
                ev.put('saturday', mob.wfrecon__Include_Saturday__c);
                ev.put('sunday', mob.wfrecon__Include_Sunday__c);
                ev.put('jobId', mob.wfrecon__Job__c);
                ev.put('allDay', true);
                ev.put('desc',mob.wfrecon__Description__c);

                if (mob.wfrecon__Job__r?.wfrecon__Address__c != null) {
                    ev.put('jobLocation', mob.wfrecon__Job__r.wfrecon__Address__c);
                }

                if (mob.wfrecon__Mobilization_Status__c != null) {
                    ev.put('status', mob.wfrecon__Mobilization_Status__c);
                    wfrecon__Mobilization_Status_Color__c colorConfig = colorMap.get(mob.wfrecon__Mobilization_Status__c);
                    if (colorConfig != null) {
                        ev.put('backgroundColor', colorConfig.wfrecon__Background_Color__c);
                        ev.put('textColor', colorConfig.wfrecon__Color__c);
                    }
                }
                result.add(ev);
            }
            return result;

        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{ 'className' => CLASSNAME, 'methodName' => 'getEvents', 'isApiException' => false, 'statusCode' => null, 'exceptionObj' => e, 'moreDetails' => 'Error occurred while fetching events for mobilization calendar.', 'apiResponse' => null}); return new List<Map<String, Object>>();
        }
    }

    // ==============================
    // Delete Mobilization Group
    // ==============================
    @AuraEnabled
    public static void deleteMobilizationGroup(Id recordId){
        List<wfrecon__Mobilization_Group__c> mobGroups = [
            SELECT Id FROM wfrecon__Mobilization_Group__c WHERE Id = :recordId
        ];
        if (!mobGroups.isEmpty()) {
            delete mobGroups;
        }
    }

    @AuraEnabled
    public static List<Map<String,String>> getMobStatusOptions(){
        List<Map<String,String>> result = new List<Map<String,String>>();
        try {
            Schema.DescribeFieldResult fieldResult = wfrecon__Mobilization_Group__c.wfrecon__Mobilization_Status__c.getDescribe();
            List<Schema.PicklistEntry> ple = fieldResult.getPicklistValues();
            for( Schema.PicklistEntry f : ple){
                result.add(new Map<String,String>{'label' => f.getLabel(), 'value' => f.getValue()});
            }
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{ 'className' => CLASSNAME, 'methodName' => 'getMobStatusOptions', 'isApiException' => false, 'statusCode' => null, 'exceptionObj' => e, 'moreDetails' => 'Error occurred while fetching status options.', 'apiResponse' => null}); return null;
        }
        return result;
    }

    // ==============================
    // Save or update job schedule
    // ==============================
    // @AuraEnabled
    // public static String saveJobSchedule(Object mgp) {
    //     Wrapper.MobilizationGroup mg = 
    //         (Wrapper.MobilizationGroup) JSON.deserialize(JSON.serialize(mgp), Wrapper.MobilizationGroup.class);

    //     wfrecon__Mobilization_Group__c mgObj = mg.getMobilizationGroupSObject();

    //     Time shiftStart = Time.newInstance(mg.startDate.hour(), mg.startDate.minute(), 0, 0);
    //     Time shiftEnd   = Time.newInstance(mg.endDate.hour(), mg.endDate.minute(), 0, 0);

    //     mgObj.wfrecon__Start_Date__c = updateDateFromTime(shiftStart, mg.startDate);
    //     mgObj.wfrecon__End_Date__c   = updateDateFromTime(shiftEnd, mg.endDate);

    //     upsert mgObj;
    //     return 'SUCCESS';
    // }

    // ==============================
    // Utility Methods
    // ==============================
    private static Datetime updateDateFromTime(Time target, Datetime source) {
        return Datetime.newInstance(
            source.year(), source.month(), source.day(),
            target.hour(), target.minute(), target.second()
        );
    }

    @AuraEnabled(cacheable=true)
    public static DefaultTimeWrapper getJobDefaultTimes(String startDate, String endDate) {
        DefaultTimeWrapper defaults = new DefaultTimeWrapper();
        
        try {
            List<wfrecon__Job_Default_Times__c> jobDefaultTimes = wfrecon__Job_Default_Times__c.getAll().values();
            if (jobDefaultTimes.isEmpty()) throw new AuraHandledException('No default times found');

            wfrecon__Job_Default_Times__c jobDefault = jobDefaultTimes[0];
            String startTimeStr = jobDefault.wfrecon__Start_Time__c;
            String endTimeStr = jobDefault.wfrecon__End_Time__c;

            Date onlyStartDate = Date.valueOf(startDate);
            Date onlyEndDate = Date.valueOf(endDate).addDays(-1);

            // Start Time
            if(startTimeStr != null) {
                List<String> startParts = startTimeStr.split(' ');
                List<String> hm = startParts[0].split(':');
                Integer hour = Integer.valueOf(hm[0]);
                Integer minute = Integer.valueOf(hm[1]);
                String modifier = startParts[1];
                
                if(modifier == 'PM' && hour < 12) hour += 12;
                if(modifier == 'AM' && hour == 12) hour = 0;

                defaults.startDateTime = DateTime.newInstance(onlyStartDate, Time.newInstance(hour, minute, 0, 0));
            }
            
            // End Time
            if(endTimeStr != null) {
                List<String> endParts = endTimeStr.split(' ');
                List<String> hm = endParts[0].split(':');
                Integer hour = Integer.valueOf(hm[0]);
                Integer minute = Integer.valueOf(hm[1]);
                String modifier = endParts[1];
                
                if(modifier == 'PM' && hour < 12) hour += 12;
                if(modifier == 'AM' && hour == 12) hour = 0;
                
                defaults.endDateTime = DateTime.newInstance(onlyEndDate, Time.newInstance(hour, minute, 0, 0));
            }
            defaults.IncludeSaturday = jobDefault.wfrecon__Include_Saturday__c;
            defaults.IncludeSunday = jobDefault.wfrecon__Include_Sunday__c;

        } catch (Exception e) {
            // Fallback default values
            defaults.startDateTime = null;
            defaults.endDateTime = null;
            defaults.IncludeSaturday = false;
            defaults.IncludeSunday = false;
        }
        return defaults;
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
            ExceptionHandler.logException(new Map<String, Object>{ 'className' => CLASSNAME, 'methodName' => 'getTimeZoneOffset', 'isApiException' => false, 'statusCode' => null, 'exceptionObj' => e, 'moreDetails' => 'Error occurred while fetching time zone offset.', 'apiResponse' => null });
        }
        return offsetHours;
    }

    @AuraEnabled
    public static String SaveJobSchedule(Map<String, String> mgMap) {

        try{
            wfrecon__Mobilization_Group__c mg = new wfrecon__Mobilization_Group__c(
                Id = mgMap.get('id'),
                wfrecon__Start_Date__c = Datetime.valueOf(mgMap.get('startDate').replace('T',' ').replace('Z','')),
                wfrecon__End_Date__c = Datetime.valueOf(mgMap.get('endDate').replace('T',' ').replace('Z','')),
                wfrecon__Job__c = mgMap.get('job'),
                wfrecon__Include_Saturday__c = Boolean.valueOf(mgMap.get('includeSaturday')),
                wfrecon__Include_Sunday__c = Boolean.valueOf(mgMap.get('includeSunday')),
                wfrecon__Mobilization_Status__c = mgMap.get('mobilizationStatus'),
                wfrecon__Description__c = mgMap.get('description')
            );
            upsert mg;
            return 'SUCCESS';
        }catch(Exception e){
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME , 'methodName' => 'SaveJobSchedule', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});
            return null;
        }        
    }

    @AuraEnabled
    public static Wrapper.MobilizationGroup getMobilizationGroup(Id recordId){
        List<wfrecon__Mobilization_Group__c> mobiGroups = [SELECT Id, wfrecon__Description__c,Name, wfrecon__Job__c,wfrecon__Job__r.wfrecon__Job_Name__c,wfrecon__Job__r.Name, wfrecon__Include_Saturday__c, wfrecon__Include_Sunday__c, wfrecon__Start_Date__c, wfrecon__End_Date__c, wfrecon__Mobilization_Status__c,toLabel(wfrecon__Mobilization_Status__c) mobStatus FROM wfrecon__Mobilization_Group__c WHERE Id = :recordId LIMIT 1];
        return new Wrapper.MobilizationGroup(mobiGroups[0]);
    }   

    public class DefaultTimeWrapper {
        @AuraEnabled public DateTime startDateTime { get; set; }
        @AuraEnabled public DateTime endDateTime{ get; set; }
        @AuraEnabled public Boolean IncludeSaturday { get; set; }
        @AuraEnabled public Boolean IncludeSunday { get; set; }
    }
}