public with sharing class NewMobilizationCalendarController {
    private static final String CLASSNAME = 'NewMobilizationCalendarController';
        // ==============================
        // Event Fetching for FullCalendar
        // ==============================
    @AuraEnabled
    public static List<Map<String, Object>> getEvents(Id job, String status) {
        try {
            Map<String, Object> permissionMap = PermissionsUtility.checkPermissionSetsAssigned(new List<String>{'FR_Mobilization_Calendar'});
            Boolean isAdmin = (Boolean) permissionMap.get('isAdmin');
            Boolean isCalendarPS = (Boolean) permissionMap.get('all');

            String baseQuery = 'SELECT Id, Name, Start_Date__c, End_Date__c, Mobilization_Status__c, Description__c, Include_Sunday__c, Include_Saturday__c, ' +
                       'Job__c, Job__r.Job_Name__c, Job__r.Name, Job__r.Address__c ' +
                       'FROM Mobilization_Group__c ';

            // List to hold dynamic filters
            List<String> filters = new List<String>();
            if (job != null) {
                filters.add('Job__c = :job');
            }
            if (status != null && status != '') {
                filters.add('Mobilization_Status__c = :status');
            }
            if(!isAdmin && !isCalendarPS){
                List<Mobilization_Member__c> mobGroupMap = [SELECT Mobilization__r.Mobilization_Group__c FROM Mobilization_Member__c WHERE Contact__r.User__c =: UserInfo.getUserId() WITH USER_MODE];
                Set<Id> mobGroupIds = new Set<Id>();
                for(Mobilization_Member__c mobGroup : mobGroupMap){
                    mobGroupIds.add(mobGroup.Mobilization__r.Mobilization_Group__c);
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
            List<Mobilization_Group__c> mobGroups = Database.query(baseQuery);

            // Fetch all custom setting records for status colors
            Map<String, Mobilization_Status_Color__c> colorMap = Mobilization_Status_Color__c.getAll();

            List<Map<String, Object>> result = new List<Map<String, Object>>();
            for (Mobilization_Group__c mob : mobGroups) {

                Map<String, Object> ev = new Map<String, Object>();
                ev.put('id', mob.Id);
                ev.put('title', mob.Job__r.Job_Name__c + ' - ' + mob.Job__r.Name);
                ev.put('start', mob.Start_Date__c);
                ev.put('timestart', mob.Start_Date__c.format('hh:mm a'));
                ev.put('timeend', mob.End_Date__c.format('hh:mm a'));
                ev.put('end', mob.End_Date__c != null ? mob.End_Date__c.addDays(1) : mob.End_Date__c);
                ev.put('saturday', mob.Include_Saturday__c);
                ev.put('sunday', mob.Include_Sunday__c);
                ev.put('jobId', mob.Job__c);
                ev.put('allDay', true);
                ev.put('desc',mob.Description__c);

                if (mob.Job__r?.Address__c != null) {
                    ev.put('jobLocation', mob.Job__r.Address__c);
                }

                if (mob.Mobilization_Status__c != null) {
                    ev.put('status', mob.Mobilization_Status__c);
                    Mobilization_Status_Color__c colorConfig = colorMap.get(mob.Mobilization_Status__c);
                    if (colorConfig != null) {
                        ev.put('backgroundColor', colorConfig.Background_Color__c);
                        ev.put('textColor', colorConfig.Color__c);
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
        List<Mobilization_Group__c> mobGroups = [
            SELECT Id FROM Mobilization_Group__c WHERE Id = :recordId
        ];
        if (!mobGroups.isEmpty()) {
            delete mobGroups;
        }
    }

    @AuraEnabled(cacheable=true)
    public static List<Job__c> getJobs(){
        try {
            List<Job__c> jobsList = [SELECT Id, Name FROM Job__c WITH USER_MODE];
            return jobsList;
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{ 'className' => CLASSNAME, 'methodName' => 'getJobs', 'isApiException' => false, 'statusCode' => null, 'exceptionObj' => e, 'moreDetails' => 'Error occurred while fetching jobs for mobilization calendar.', 'apiResponse' => null}); return null;
        }
    }

    // ==============================
    // Save or update job schedule
    // ==============================
    // @AuraEnabled
    // public static String saveJobSchedule(Object mgp) {
    //     Wrapper.MobilizationGroup mg = 
    //         (Wrapper.MobilizationGroup) JSON.deserialize(JSON.serialize(mgp), Wrapper.MobilizationGroup.class);

    //     Mobilization_Group__c mgObj = mg.getMobilizationGroupSObject();

    //     Time shiftStart = Time.newInstance(mg.startDate.hour(), mg.startDate.minute(), 0, 0);
    //     Time shiftEnd   = Time.newInstance(mg.endDate.hour(), mg.endDate.minute(), 0, 0);

    //     mgObj.Start_Date__c = updateDateFromTime(shiftStart, mg.startDate);
    //     mgObj.End_Date__c   = updateDateFromTime(shiftEnd, mg.endDate);

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
    public static DefaultTimeWrapper getJobDefaultTimes() {
        DefaultTimeWrapper defaults = new DefaultTimeWrapper();
        
        try {
            List<Job_Default_Times__c> jobDefaultTimes = Job_Default_Times__c.getAll().values();
            if (jobDefaultTimes.isEmpty()) throw new AuraHandledException('No default times found');

            Job_Default_Times__c jobDefault = jobDefaultTimes[0];

            // Parse Start Time
            String startTimeStr = jobDefault.Start_Time__c; // format: "07:00 AM"
            Matcher startMatch = Pattern.compile('(\\d+):(\\d+)\\s?(AM|PM)').matcher(startTimeStr);
            if (startMatch.matches()) {
                Integer startHour = Integer.valueOf(startMatch.group(1));
                Integer startMinute = Integer.valueOf(startMatch.group(2));
                String ampm = startMatch.group(3);
                
                if (ampm == 'PM' && startHour != 12) startHour += 12;
                if (ampm == 'AM' && startHour == 12) startHour = 0;
                
                defaults.StartHour = String.valueOf(startHour);
                defaults.StartMinute = String.valueOf(startMinute);
            } else {
                defaults.StartHour = '07';
                defaults.StartMinute = '00';
            }

            // Parse End Time
            String endTimeStr = jobDefault.End_Time__c; // format: "06:00 PM"
            Matcher endMatch = Pattern.compile('(\\d+):(\\d+)\\s?(AM|PM)').matcher(endTimeStr);
            if (endMatch.matches()) {
                Integer endHour = Integer.valueOf(endMatch.group(1));
                Integer endMinute = Integer.valueOf(endMatch.group(2));
                String ampm = endMatch.group(3);
                
                if (ampm == 'PM' && endHour != 12) endHour += 12;
                if (ampm == 'AM' && endHour == 12) endHour = 0;
                
                defaults.EndHour = String.valueOf(endHour);
                defaults.EndMinute = String.valueOf(endMinute);
            } else {
                defaults.EndHour = '18';
                defaults.EndMinute = '00';
            }

            defaults.IncludeSaturday = jobDefault.Include_Saturday__c;
            defaults.IncludeSunday = jobDefault.Include_Sunday__c;

        } catch (Exception e) {
            // Fallback default values
            defaults.StartHour = '07';
            defaults.StartMinute = '00';
            defaults.EndHour = '18';
            defaults.EndMinute = '00';
            defaults.IncludeSaturday = false;
            defaults.IncludeSunday = false;
        }
        return defaults;
    }

    @AuraEnabled
    public static String SaveJobSchedule(Object mgp) {
        Wrapper.MobilizationGroup mg = (Wrapper.MobilizationGroup) JSON.deserialize(JSON.serialize(mgp),Wrapper.MobilizationGroup.Class);
        Date startDate = Date.newInstance(mg.startDate.year(), mg.startDate.month(), mg.startDate.day());
        Date endDate = Date.newInstance(mg.endDate.year(), mg.endDate.month(), mg.endDate.day());
        Time shiftStart = Time.newInstance(mg.startDate.hour(), mg.startDate.minute(), 0, 0);
        Time shiftEnd = Time.newInstance(mg.endDate.hour(), mg.endDate.minute(), 0, 0);

        Mobilization_Group__c mgObj = mg.getMobilizationGroupSObject();
        mgObj.Start_Date__c = updateDateFromTime(shiftStart, mg.startDate);
        mgObj.End_Date__c = updateDateFromTime(shiftEnd, mg.endDate);
        upsert mgObj;
        return 'SUCCESS';
    }

    @AuraEnabled
    public static Wrapper.MobilizationGroup getMobilizationGroup(Id recordId){
        List<Mobilization_Group__c> mobiGroups = [SELECT Id, Description__c,Name, Job__c,Job__r.Job_Name__c,Job__r.Name, Include_Saturday__c, Include_Sunday__c, Start_Date__c, End_Date__c, Mobilization_Status__c,toLabel(Mobilization_Status__c) mobStatus FROM Mobilization_Group__c WHERE Id = :recordId LIMIT 1];
        return new Wrapper.MobilizationGroup(mobiGroups[0]);
    }   

    public class DefaultTimeWrapper {
        @AuraEnabled public String StartHour { get; set; }
        @AuraEnabled public String StartMinute { get; set; }
        @AuraEnabled public String EndHour { get; set; }
        @AuraEnabled public String EndMinute { get; set; }
        @AuraEnabled public Boolean IncludeSaturday { get; set; }
        @AuraEnabled public Boolean IncludeSunday { get; set; }
    }
}