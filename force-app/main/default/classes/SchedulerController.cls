public class SchedulerController {
    @AuraEnabled
    public static Util.accessWrapper checkProfileAccess(String objName) {
        return Util.checkAccess(objName);
    }

    public static Boolean checkThirdLevelAccess() {
        return Util.thirdLevelFeatureAccess();
    }

    @AuraEnabled
    public static defaultsWrapper GetDefaults() {
    
        defaultsWrapper df = new defaultsWrapper();
        List<Job_Default_Times__c> jobDefaultTimes = Job_Default_Times__c.getall().values();
        try {
            df.defaultStartTime = jobDefaultTimes[0].Start_Time__c;
            df.defaultEndTime = jobDefaultTimes[0].End_Time__c;
            df.includeSaturday = jobDefaultTimes[0].Include_Saturday__c;
            df.includeSunday = jobDefaultTimes[0].Include_Sunday__c;
        } catch (Exception e) {
            System.debug(e.getMessage());
            System.debug(e.getStackTraceString());
            df.defaultStartTime = '08:00 AM';
            df.defaultEndTime = '05:00 PM';
            df.includeSaturday = false;
            df.includeSunday = false;
        }
        Boolean hasLevelTwoAccess = Util.secondLevelFeatureAccess() || Util.thirdLevelFeatureAccess();
        if(!hasLevelTwoAccess){
            throw new HandledException('Second Level Feature Pack Required! Please Contact Your Admin!');
        }

        df.defaultStartTime = df.defaultStartTime == null ? '08:00 AM' : df.defaultStartTime;
        df.defaultEndTime = df.defaultEndTime == null ? '05:00 PM' : df.defaultEndTime;

        List<String> dst = df.defaultStartTime.split(' ');
        List<String> hm = dst[0].split(':');

        Integer hour = Integer.valueOf(hm[0]);
        Integer minute = Integer.valueOf(hm[1]);
        hour = dst[1] == 'PM' ? hour + 12 : hour;

        df.defaultDate = DateTime.newInstance(
            System.now().year(),
            System.now().month(),
            System.now().day(),
            hour,
            minute,
            0
        );

        List<String> det = df.defaultEndTime.split(' ');
        List<String> hmEnd = det[0].split(':');

        Integer hourEnd = Integer.valueOf(hmEnd[0]);
        Integer minuteEnd = Integer.valueOf(hmEnd[1]);
        hourEnd = det[1] == 'PM' ? hourEnd + 12 : hourEnd;

        df.defaultEndDate = DateTime.newInstance(
            System.now().year(),
            System.now().month(),
            System.now().day(),
            hourEnd,
            minuteEnd,
            0
        );

        Map<String, String> eventColorMap = new Map<String, String>();
        Map<String, String> eventTxtColorMap = new Map<String, String>();
        for (Mobilization_Status_Color__c c : Mobilization_Status_Color__c.getAll().values()) {
            eventColorMap.put(c.Name, c.Background_Color__c);
            eventTxtColorMap.put(c.Background_Color__c, c.Color__c);
        }

        df.jobStatusList = new List<PicklistValuesWrapper>();
        Schema.DescribeFieldResult fieldResult = Mobilization__c.Mobilization_Status__c.getDescribe();
        List<Schema.PicklistEntry> listMobilizationPicklistValues = fieldResult.getPicklistValues();

        for (Schema.PicklistEntry ple : listMobilizationPicklistValues) {
            if (ple.isActive()) {
                df.jobStatusList.add(new PicklistValuesWrapper(ple.getValue(),ple.getLabel()));
                //df.jobStatusList.add(ple.getLabel());
            }
        }
        
        return df;
    }

    @AuraEnabled
    public static List<DateWiseWrapper> GetJobData(
        String selectedStatuses,
        String startDate,
        String endDate,
        String device
    ) {
        Date sd;
        try {
            sd = String.isEmpty(startDate) && String.isBlank(startDate) ? System.Today() : Date.valueOf(startDate);
        } catch (exception e) {
            sd = System.today();
        }
        Date ed;
        try {
            ed = String.isEmpty(endDate) && String.isBlank(endDate) ? System.Today() : Date.valueOf(endDate);
        } catch (exception e) {
            ed = System.today();
        }
        String defaultStartTime, defaultEndTime = '';
        List<Job_Default_Times__c> jobDefaultTimes = Job_Default_Times__c.getall().values();
        try {
            defaultStartTime = jobDefaultTimes[0].Start_Time__c;
            defaultEndTime = jobDefaultTimes[0].End_Time__c;
        } catch (Exception e) {
            defaultStartTime = '08:00 AM';
            defaultEndTime = '05:00 PM';
        }

        List<String> filterStatuses = new List<String>();
        try {
            filterStatuses = String.isEmpty(selectedStatuses) && String.isBlank(selectedStatuses)
                ? new List<String>()
                : selectedStatuses.split(';');
        } catch (Exception e) {
            filterStatuses = new List<String>();
        }

        List<User> userList = SchedulerController.getCrewUsers();
        List<Equipment__c> assetList = new List<Equipment__c>();
        if(SchedulerController.checkThirdLevelAccess()) {
         	assetList = SchedulerController.getCrewAssets();   
        }
        List<Contact> contacts = SchedulerController.getSubContractors();
        Map<Date, List<Mobilization__c>> mobilizationMap = new Map<Date, List<Mobilization__c>>();

        List<Mobilization__c> mbList = new List<Mobilization__c>();
        System.debug(filterStatuses);
        System.debug(sd);
        System.debug(ed);
        mbList = SchedulerController.getMobilizations(filterStatuses, sd, ed, device);
        System.debug(mbList);
        Set<String> mobilizationIdSet = new Set<String>();

        for (Mobilization__c mob : mbList) {
            mobilizationIdSet.add(mob.Id);

            Date mobDate = mob.Start_Date__c.Date();

            if (mobilizationMap.containskey(mobDate)) {
                mobilizationMap.get(mobDate).add(mob);
            } else {
                mobilizationMap.put(mobDate, new List<Mobilization__c>{ mob });
            }
        }

        Map<String, List<Mobilization_Asset__c>> mobAssetMap = new Map<String, List<Mobilization_Asset__c>>();
        String soql = 'SELECT Id,Name,Mobilization__c,Mobilization__r.Start_Date__c';
        String levelThreeQuery = '';
        if(SchedulerController.checkThirdLevelAccess()) {
         	levelThreeQuery = ',Equipment__c,Equipment__r.Name,Equipment__r.Asset_Type__c';   
        }
        soql = soql + levelThreeQuery + 
            ' FROM Mobilization_Asset__c WHERE Mobilization__c IN :arg1 AND Active__c = true' +
            ' WITH SECURITY_ENFORCED';

        
        for (
            Mobilization_Asset__c ms : (Mobilization_Asset__c[]) Lib_Security.ws()
                .dbQuery(soql, new List<Object>{ mobilizationIdSet })
        ) {
            if (!mobAssetMap.containskey(ms.Mobilization__c)) {
                mobAssetMap.put(ms.Mobilization__c, new List<Mobilization_Asset__c>{ ms });
            } else {
                mobAssetMap.get(ms.Mobilization__c).add(ms);
            }
        }

        List<DateWiseWrapper> returnList = new List<DateWiseWrapper>();
        System.debug(mobilizationMap);
        for (Date d : mobilizationMap.keyset()) {
            DateWiseWrapper dww = new DateWiseWrapper();
            dww.jobDate = d;
            dww.jobWrapperList = new List<JobWrapper>();

            Set<String> selectedUsersSet = new Set<String>();
            Set<String> selectedSubContractorSet = new Set<String>();
            Set<String> selectedAssetsSet = new Set<String>();

            for (Mobilization__c m : mobilizationMap.get(d)) {
                dww.jobDateString = m.Start_Date__c.format('EEEE MMM dd, yyyy');
                dww.jobDefaultStartDateTime = SchedulerController.getDefaultDateTime(m.Start_Date__c, defaultStartTime);
                dww.jobDefaultEndDateTime = SchedulerController.getDefaultDateTime(m.End_Date__c, defaultEndTime);
                
                List<SubContractorMemberWrapper> subConMemberList = new List<SubContractorMemberWrapper>();
                List<JobMemberWrapper> jobMemberList = new List<JobMemberWrapper>();
                for (Mobilization_Member__c mt : m.Mobilization_Members__r) {
                    if(mt.wfrecon__Contact__r.RecordType.DeveloperName == 'Sub_Contractor_WF_Recon'){
                        subConMemberList.add(new SubContractorMemberWrapper(mt.Id, mt.wfrecon__Contact__r.Name, mt.wfrecon__Contact__c));
                        selectedSubContractorSet.add(mt.wfrecon__Contact__c);
                    }else {
                        jobMemberList.add(new JobMemberWrapper(mt.Id, mt.Contact__r.User__r.Name, mt.Contact__r.User__c));
                        selectedUsersSet.add(mt.Contact__r.User__c);
                    }
                }
        
                List<MobilizationAssetWrapper> jobAssetList = new List<MobilizationAssetWrapper>();
                if (mobAssetMap.containskey(m.Id) && SchedulerController.checkThirdLevelAccess()) {
                    for (Mobilization_Asset__c ma : mobAssetMap.get(m.Id)) {
                        jobAssetList.add(
                            new MobilizationAssetWrapper(
                                ma.Equipment__c,
                                ma.Id,
                                ma.Equipment__r.Name,
                                ma.Equipment__r.Asset_Type__c
                            )
                        );
                        selectedAssetsSet.add(ma.Equipment__c);
                    }
                }

                JobWrapper jw = new JobWrapper(
                    m.Job__c,
                    m.Job__r.Job_Name__c,
                    m.Id,
                    m.Job__r.Name,
                    m.Mobilization_Status__c,
                    (String) m.get('mobStatus'),
                    m.Mobilization_Group__c,
                    m.Start_Date__c.date(),
                    m.End_Date__c.date(),
                    m.Start_Date__c.format('hh:mm a'),
                    m.End_Date__c.format('hh:mm a'),
                    m.Start_Date__c,
                    m.End_Date__c,
                    m.Notes__c,
                    jobMemberList,
                    subConMemberList,
                    jobAssetList
                );

                dww.jobWrapperList.add(jw);
            }

            List<CrewWrapper> cwList = new List<CrewWrapper>();
            for (User u : userList) {
                cwList.add(new CrewWrapper(u.Id, u.Name, selectedUsersSet.contains(u.Id) ? true : false));
            }

            cwList.sort();
            dww.crewList = cwList;
            dww.crewDisplayList = cwList;

            List<SubContractorWrapper> subConList = new List<SubContractorWrapper>();
            for (Contact con : contacts) {
                subConList.add(new SubContractorWrapper(con.Id, con.Name, selectedSubContractorSet.contains(con.Id) ? true : false));
            }

            subConList.sort();
            dww.subContractorList = subConList;
            dww.subContractorDisplayList = subConList;

            List<AssetWrapper> awList = new List<AssetWrapper>();
            for (Equipment__c a : assetList) {
                awList.add(
                    new AssetWrapper(a.Id, a.Name, selectedAssetsSet.contains(a.Id) ? true : false, a.Asset_Type__c)
                );
            }

            awList.sort();
            dww.assetList = awList;
            dww.assetDisplayList = awList;

            dww.crewIdList = selectedUsersSet.size() > 0 ? new List<String>(selectedUsersSet) : new List<String>();
            dww.subContractorIdList = selectedSubContractorSet.size() > 0 ? new List<String>(selectedSubContractorSet) : new List<String>();
            dww.assetIdList = selectedAssetsSet.size() > 0 ? new List<String>(selectedAssetsSet) : new List<String>();

            returnList.add(dww);
        }
        System.debug(returnList);
        return returnList;
    }

    @AuraEnabled
    public static String SaveJobSchedule(String jobId, DateTime startDateTime, DateTime endDateTime, String status,Boolean incSatur,Boolean incSun) {
        List<Job__c> jobList = Lib_Security.ws()
            .dbQuery('SELECT Id FROM Job__c WHERE Id = :arg1', new List<Object>{ jobId });

        if (jobList.size() == 0) {
            throw Lib_Error.create(Lib_Error.Cause.Callout, 'A Valid Job is Required');
            //throw new AuraHandledException('A Valid Job is Required');
        }
        Date startDate = Date.newInstance(startDateTime.year(), startDateTime.month(), startDateTime.day());
        Date endDate = Date.newInstance(endDateTime.year(), endDateTime.month(), endDateTime.day());

        Time shiftStart = Time.newInstance(startDateTime.hour(), startDateTime.minute(), 0, 0);
        Time shiftEnd = Time.newInstance(endDateTime.hour(), endDateTime.minute(), 0, 0);

        Date startDateCounter = startDate;
        Date endDateCounter = endDate;
        Mobilization_Group__c mGroup= new Mobilization_Group__c(
                        Job__c = jobList[0].Id,
                        Start_Date__c = DateTime.newInstance(
                            startDateCounter.year(),
                            startDateCounter.month(),
                            startDateCounter.day(),
                            shiftStart.hour(),
                            shiftStart.minute(),
                            shiftStart.second()
                        ),
                        End_Date__c = DateTime.newInstance(
                            endDateCounter.year(),
                            endDateCounter.month(),
                            endDateCounter.day(),
                            shiftEnd.hour(),
                            shiftEnd.minute(),
                            shiftEnd.second()
                        ),
                        Mobilization_Status__c = Status,
                        Include_Saturday__c = incSatur,
                        Include_Sunday__c = incSun
                );
        Lib_Security.ws().dbInsert(new Mobilization_Group__c[]{mGroup});
        return 'SUCCESS';
    }

    @AuraEnabled
    public static String DeleteJobSchedule(String jobId, String mobId, Boolean deleteAll,String mobGroupId) {
        String response = 'SUCCESS';
        String soql = 'SELECT Id, Start_Date__c FROM Mobilization__c WHERE Mobilization_Group__c = :arg1';
        if(!deleteAll){
            soql += ' AND Id = :arg2';
        }
        List<Mobilization__c> mobList = Lib_Security.ws()
            .dbQuery(soql, new List<Object>{ mobGroupId,mobId });
        if (!mobList.isEmpty()) {
            Lib_Security.ws().dbDelete(mobList);
        }
        //response = 'FAIL';
        return response;
    }

    @AuraEnabled
    public static String CopySchedule(String jobId, String mobId, DateTime startDate, DateTime endDate,String mobGroupId) {
        String response = 'SUCCESS';

        List<Mobilization_Member__c> deleteMobList = new List<Mobilization_Member__c>();
        List<Mobilization_Member__c> insertMobTList = new List<Mobilization_Member__c>();

        List<Mobilization_Asset__c> deleteMobAList = new List<Mobilization_Asset__c>();
        List<Mobilization_Asset__c> insertMobAList = new List<Mobilization_Asset__c>();

        List<Mobilization__c> updateMobList = new List<Mobilization__c>();

        String mobQuery =
            'SELECT' +
            ' Id,' +
            ' Start_Date__c,' +
            ' End_Date__c,' +
            ' (' +
            '    SELECT' +
            '        Id, ' +
            '        Date_on_Site__c, ' +
            '        Mobilization__c, ' +
            '        Contact__c, ' +
            '        Contact__r.User__c, ' +
            '        Contact__r.User__r.Name ' +
            '    FROM Mobilization_Members__r ' +
            ') ';
            if(SchedulerController.checkThirdLevelAccess()) {
                mobQuery += ',( ' +
                '    SELECT Id, Mobilization__c, Equipment__c, Active__c ' +
                '    FROM Mobilization_Assets__r ' +
                '    WHERE Active__c = true ' +
                ') ';   
           }
            mobQuery +=
            ' FROM Mobilization__c ' +
            ' WHERE Id = :arg1 AND Start_Date__c >= :arg2 AND Mobilization_Group__c = :arg3 ' +
            ' WITH SECURITY_ENFORCED ';
        List<Mobilization__c> mobList = Lib_Security.ws().dbQuery(mobQuery, new List<Object>{ mobId, startDate,mobGroupId });
        if (!mobList.isEmpty()) {
            String query =
                'SELECT ' +
                'Id, ' +
                'Job__c, ' +
                'Start_Date__c, ' +
                'End_Date__c, ' +
                '( ' +
                '    SELECT ' +
                '    Id, ' +
                '    Date_on_Site__c, ' +
                '    Mobilization__c, ' +
                '    Contact__c, ' +
                '    Contact__r.User__c ' +
                //'    Contact__r.User__r.Name '+
                'FROM Mobilization_Members__r ' +
                //'WHERE Contact__r.User__c != null ' +
                'ORDER BY Date_on_Site__c ' +
                ') ';
                if(SchedulerController.checkThirdLevelAccess()) {
                    query += ',( ' +
                    'SELECT Id, Mobilization__c, Equipment__c, Active__c ' +
                    'FROM Mobilization_Assets__r ' +
                    'WHERE Active__c = true ' +
                    ') ';   
               }
                query +=
                'FROM Mobilization__c ' +
                'WHERE id != :arg1 AND Job__c = :arg2 AND Start_Date__c >= :arg3 AND End_Date__c != null  AND Mobilization_Group__c = :arg4 ' +
                'WITH SECURITY_ENFORCED ' +
                'ORDER BY Start_Date__c';
            List<Mobilization__c> mobilizationList = Lib_Security.ws()
                .dbQuery(query, new List<Object>{ mobList[0].Id, jobId, startDate , mobGroupId});
            for (Mobilization__c rm : mobilizationList) {
                /*DateTime newStartDate = DateTime.newInstance(
                    rm.Start_Date__c.year(),
                    rm.Start_Date__c.month(),
                    rm.Start_Date__c.day(),
                    startDate.hour(),
                    startDate.minute(),
                    0
                );

                DateTime newEndDate = DateTime.newInstance(
                    rm.End_Date__c.year(),
                    rm.End_Date__c.month(),
                    rm.End_Date__c.day(),
                    endDate.hour(),
                    endDate.minute(),
                    0
                );

                rm.Start_Date__c = newStartDate;
                rm.End_Date__c = newEndDate;

                updateMobList.add(rm);*/
                deleteMobList.addAll(rm.Mobilization_Members__r);

                for (Mobilization_Member__c mtm : mobList[0].Mobilization_Members__r) {
                    insertMobTList.add(
                        new Mobilization_Member__c(Mobilization__c = rm.Id, Contact__c = mtm.Contact__c)
                    );
                }

                deleteMobAList.addAll(rm.Mobilization_Assets__r);

                if(SchedulerController.checkThirdLevelAccess()){
                    for (Mobilization_Asset__c ma : mobList[0].Mobilization_Assets__r) {
                        insertMobAList.add(
                            new Mobilization_Asset__c(
                                Mobilization__c = rm.Id,
                                Active__c = true,
                                Equipment__c = ma.Equipment__c
                            )
                        );
                    }
                }
            }

            if (!deleteMobList.isEmpty())
                Lib_Security.ws().dbDelete(deleteMobList);

            if (!insertMobTList.isEmpty())
                Lib_Security.ws().dbInsert(insertMobTList);

            if (!deleteMobAList.isEmpty())
                Lib_Security.ws().dbDelete(deleteMobAList);

            if (!insertMobAList.isEmpty())
                Lib_Security.ws().dbInsert(insertMobAList);

            if (!updateMobList.isEmpty())
                Lib_Security.ws().dbUpsert(updateMobList);
        }
        Lib_Security.ws().dbUpdate(new Mobilization_Group__c[]{new Mobilization_Group__c(Id=mobGroupId,AddAssetUser__c=true)});
        return response;
    }

    @AuraEnabled
    public static String MassUpdateSchedule(
        String recordId,
        String jobId,
        String newStatus,
        DateTime newStartDate,
        DateTime newEndDate,
        DateTime oldStartDate,
        DateTime oldEndDate,
        String mobGroupId
    ) {
        String response = '';
        if (jobId != null && newStartDate != null && newEndDate != null) {
            String soql =
                'SELECT Id, Mobilization_Status__c, Start_Date__c, End_Date__c FROM Mobilization_Group__c ' +
                'WHERE Id = :arg1 WITH SECURITY_ENFORCED';
            List<Mobilization_Group__c> mGroup = (Mobilization_Group__c[]) Lib_Security.ws()
                .dbQuery(soql, new Object[]{mobGroupId});
                
            mGroup[0].Start_Date__c =DateTime.newInstance(
                mGroup[0].Start_Date__c.year(),
                mGroup[0].Start_Date__c.month(),
                mGroup[0].Start_Date__c.day(),
                newStartDate.hour(),
                newStartDate.minute(),
                newStartDate.second()
            );
            mGroup[0].End_Date__c = DateTime.newInstance(
                mGroup[0].End_Date__c.year(),
                mGroup[0].End_Date__c.month(),
                mGroup[0].End_Date__c.day(),
                newEndDate.hour(),
                newEndDate.minute(),
                newEndDate.second()
            );
            mGroup[0].Mobilization_Status__c = newStatus;
            if (!mGroup.isEmpty()){
                Lib_Security.ws().dbUpsert(mGroup);
                response = 'SUCCESS';
            } else {
                response = 'INVALID';
            }
        }
        return response;
    }
    //private method to create new Mobilizations.
    private static List<Mobilization__c> createNewMobilizations(
        DateTime startLoop,
        DateTime endLoop,
        DateTime newStartDate,
        DateTime newEndDate,
        String jobId,
        String newStatus
    ) {
        List<Mobilization__c> createMobs = new List<Mobilization__c>();
        while (startLoop <= endLoop) {
            Mobilization__c m = new Mobilization__c();
            m.Mobilization_Status__c = newStatus;
            m.Start_Date__c = DateTime.newInstance(
                startLoop.year(),
                startLoop.month(),
                startLoop.day(),
                newStartDate.hour(),
                newStartDate.minute(),
                newStartDate.second()
            );
            m.End_Date__c = DateTime.newInstance(
                startLoop.year(),
                startLoop.month(),
                startLoop.day(),
                newEndDate.hour(),
                newEndDate.minute(),
                newEndDate.second()
            );
            m.Job__c = jobId;
            createMobs.add(m);
            startLoop = startLoop.addDays(1);
        }
        return createMobs;
    }
    @AuraEnabled
    public static String MassUpdateScheduleDetails(
        String jobId,
        String newStatus,
        DateTime newStartDate,
        DateTime newEndDate,
        DateTime oldStartDate,
        DateTime oldEndDate
    ) {
        String response = '';
        if (jobId != null && newStartDate != null && newEndDate != null) {
            List<Mobilization__c> updateList = new List<Mobilization__c>();

            String soql =
                'SELECT Id, Mobilization_Status__c, Start_Date__c, End_Date__c FROM Mobilization__c ' +
                'WHERE Job__c = :arg1 AND Start_Date__c >= :arg2 AND End_Date__c <= :arg3 WITH SECURITY_ENFORCED';

            for (
                Mobilization__c m : (Mobilization__c[]) Lib_Security.ws()
                    .dbQuery(soql, new List<Object>{ jobId, newStartDate, newEndDate })
            ) {
                if (m.End_Date__c <= oldEndDate) {
                    m.Start_Date__c = newStartDate;
                    m.End_Date__c = datetime.newInstance(
                        newStartDate.year(),
                        newStartDate.month(),
                        newStartDate.day(),
                        newEndDate.hour(),
                        newEndDate.minute(),
                        newEndDate.second()
                    );
                    m.Mobilization_Status__c = newStatus;
                    updateList.add(m);
                }
                if (newStartDate <= newEndDate) {
                    newStartDate = newStartDate.addDays(1);
                }
            }

            if (!updateList.isEmpty())
                Lib_Security.ws().dbUpdate(updateList);
            response = 'SUCCESS';
        } else {
            response = 'INVALID';
        }
        //response = 'FAIL';
        return response;
    }

    // UserId needs to be updated, it can also be the mobilization record Id
    @AuraEnabled
    public static String AssignUser(string userId, string mobId, boolean chkOverlap) {
        list<Mobilization_Member__c> mtList = Lib_Security.ws()
            .dbQuery(
                'SELECT id FROM Mobilization_Member__c WHERE id = :arg1 WITH SECURITY_ENFORCED',
                new List<Object>{ userId }
            );
        if (mtList.size() > 0) {
            if (mobId == 'delete') {
                Lib_Security.ws().dbDelete(mtList);
            } else {
                String mmQuery = ' SELECT Contact__c, Mobilization__c FROM Mobilization_Member__c WHERE id = :arg1 WITH SECURITY_ENFORCED';
                Mobilization_Member__c crewUserId = (Mobilization_Member__c) Lib_Security.ws()
                    .dbQuery(mmQuery, new List<Object>{ userId })[0];

                Mobilization_Member__c mTeamCrew = new Mobilization_Member__c(
                    Contact__c = crewUserId.Contact__c,
                    Mobilization__c = mobId
                );

                String mCrewQuery =
                    'SELECT id, Start_Date__c, End_Date__c, Job__c FROM Mobilization__c' +
                    ' WHERE id = :arg1 WITH SECURITY_ENFORCED';
                List<Mobilization__c> mListCrew = Lib_Security.ws().dbQuery(mCrewQuery, new List<Object>{ mobId });

                if (mListCrew.size() > 0) {
                    Mobilization__c rm = mListCrew[0];

                    String mtQuery =
                        'SELECT id ' +
                        'FROM Mobilization_Member__c ' +
                        'WHERE ' +
                        '    Contact__c = :arg1 ' +
                        '    AND ((Mobilization__r.Start_Date__c <= :arg2 ' +
                        '    AND Mobilization__r.End_Date__c >= :arg3) ' +
                        '    OR (Mobilization__r.Start_Date__c <= :arg4 ' +
                        '    AND Mobilization__r.End_Date__c >= :arg5) ' +
                        '    OR (Mobilization__r.Start_Date__c >= :arg6 ' +
                        '    AND Mobilization__r.End_Date__c <= :arg7)) ' +
                        'WITH SECURITY_ENFORCED ' +
                        'LIMIT 1';
                    mtList = Lib_Security.ws()
                        .dbQuery(
                            mtQuery,
                            new List<Object>{
                                crewUserId.Contact__c,
                                rm.Start_Date__c,
                                rm.Start_Date__c,
                                rm.End_Date__c,
                                rm.End_Date__c,
                                rm.Start_Date__c,
                                rm.End_Date__c
                            }
                        );

                    if (mtList.size() == 0 || !chkOverlap) {
                        Lib_Security.ws().dbInsert(new List<Mobilization_Member__c>{ mTeamCrew });
                        Lib_Security.ws().dbDelete(new List<Mobilization_Member__c>{ crewUserId });
                        return 'SUCCESS';
                    } else
                        return 'Time Overlapping.';
                }
            }
        } else {
            if (userId.startsWith('005')) {
                List<Contact> contacts = Lib_Security.ws()
                    .dbQuery(
                        'SELECT Id, User__c FROM Contact ' + 'WHERE User__c = :arg1 WITH SECURITY_ENFORCED',
                        new List<Object>{ userId }
                    );

                Contact contact;
                if (contacts.size() > 0) {
                    contact = contacts[0];
                }
                Mobilization_Member__c mTeam = new Mobilization_Member__c(
                    Contact__c = contact.Id,
                    Mobilization__c = mobId
                );

                list<Mobilization__c> mList = Lib_Security.ws()
                    .dbQuery(
                        'SELECT id, Start_Date__c, End_Date__c, Job__c ' +
                        'FROM Mobilization__c WHERE id = :arg1 WITH SECURITY_ENFORCED',
                        new List<Object>{ mobId }
                    );

                if (mList.size() > 0) {
                    Mobilization__c rm = mList[0];
                    String query =
                        'SELECT id ' +
                        'FROM Mobilization_Member__c ' +
                        'WHERE ' +
                        '    Contact__c = :arg1 ' +
                        '    AND ((Mobilization__r.Start_Date__c <= :arg2 ' +
                        '    AND Mobilization__r.End_Date__c >= :arg3) ' +
                        '    OR (Mobilization__r.Start_Date__c <= :arg4 ' +
                        '    AND Mobilization__r.End_Date__c >= :arg5) ' +
                        '    OR (Mobilization__r.Start_Date__c >= :arg6 ' +
                        '    AND Mobilization__r.End_Date__c <= :arg7)) ' +
                        'WITH SECURITY_ENFORCED ' +
                        'LIMIT 1';

                    mtList = Lib_Security.ws()
                        .dbQuery(
                            query,
                            new List<Object>{
                                contact.Id,
                                rm.Start_Date__c,
                                rm.Start_Date__c,
                                rm.End_Date__c,
                                rm.End_Date__c,
                                rm.Start_Date__c,
                                rm.End_Date__c
                            }
                        );

                    if (mtList.size() == 0 || !chkOverlap) {
                        Lib_Security.ws().dbInsert(new List<Mobilization_Member__c>{ mTeam });
                        return 'SUCCESS';
                    } else {
                        return 'Time Overlapping.';
                    }
                }
            } else {
                Mobilization_Member__c mTeam = new Mobilization_Member__c(Id = userId, Mobilization__c = mobId);

                String mMemberQuery =
                    'SELECT Id, Mobilization__c, Contact__c FROM Mobilization_Member__c ' +
                    'WHERE Id = :arg1 WITH SECURITY_ENFORCED';

                list<Mobilization_Member__c> mtTempList = Lib_Security.ws()
                    .dbQuery(mMemberQuery, new List<Object>{ userId });
                String mobQuery =
                    'SELECT id, Start_Date__c, End_Date__c, Job__c FROM Mobilization__c ' +
                    'WHERE id = :arg1 WITH SECURITY_ENFORCED';

                list<Mobilization__c> mList = Lib_Security.ws()
                    .dbQuery(mobQuery, new List<Object>{ mtTempList[0].Mobilization__c });
                if (mList.size() > 0) {
                    Mobilization__c rm = mList[0];
                    String mlistQuery =
                        'SELECT id ' +
                        'FROM Mobilization_Member__c ' +
                        'WHERE ' +
                        '    Mobilization__c = :arg1 ' +
                        '    AND ((Mobilization__r.Start_Date__c <= :arg2 ' +
                        '    AND Mobilization__r.End_Date__c >= :arg3) ' +
                        '    OR (Mobilization__r.Start_Date__c <= :arg4 ' +
                        '    AND Mobilization__r.End_Date__c >= :arg5) ' +
                        '    OR (Mobilization__r.Start_Date__c >= :arg6 ' +
                        '    AND Mobilization__r.End_Date__c <= :arg7)) ' +
                        'WITH SECURITY_ENFORCED ' +
                        'LIMIT 1';

                    mtList = Lib_Security.ws()
                        .dbQuery(
                            mlistQuery,
                            new List<Object>{
                                rm.Id,
                                rm.Start_Date__c,
                                rm.Start_Date__c,
                                rm.End_Date__c,
                                rm.End_Date__c,
                                rm.Start_Date__c,
                                rm.End_Date__c
                            }
                        );
                    if (mtList.size() == 0 || !chkOverlap) {
                        String moblquery =
                            'SELECT id, Start_Date__c, End_Date__c, Job__c FROM Mobilization__c ' +
                            'WHERE id = :mobId WITH SECURITY_ENFORCED';

                        mList = Lib_Security.ws().dbQuery(moblquery, new List<Object>{ mobId });

                        Lib_Security.ws().dbUpdate(new List<Mobilization_Member__c>{ mTeam });
                        return 'Success' + mTeam.Id;
                    } else {
                        return 'Time Overlapping.';
                    }
                }
            }
        }
        return 'SUCCESS';
    }

    @AuraEnabled
    public static String AssignSubContractor(string subConId, string mobId, boolean chkOverlap,Boolean isDelete) {
        list<Mobilization_Member__c> mtList = Lib_Security.ws()
            .dbQuery(
                'SELECT id,wfrecon__Contact__c,wfrecon__Mobilization__c FROM wfrecon__Mobilization_Member__c WHERE wfrecon__Contact__c = :arg1 AND wfrecon__Mobilization__c =:arg2 WITH SECURITY_ENFORCED',
                new List<Object>{ subConId,mobId }
            );
        if (mtList.size() > 0) {
            if (isDelete == true) {
                Lib_Security.ws().dbDelete(mtList);
            } else {
                wfrecon__Mobilization_Member__c mTeamCrew = new wfrecon__Mobilization_Member__c(
                    wfrecon__Contact__c = mtList[0].wfrecon__Contact__c,
                    wfrecon__Mobilization__c = mobId
                );

                String mCrewQuery =
                    'SELECT id, wfrecon__Start_Date__c, wfrecon__End_Date__c, Job__c FROM wfrecon__Mobilization__c' +
                    ' WHERE id = :arg1 WITH SECURITY_ENFORCED';
                List<wfrecon__Mobilization__c> mListCrew = Lib_Security.ws().dbQuery(mCrewQuery, new List<Object>{ mobId });

                if (mListCrew.size() > 0) {
                    wfrecon__Mobilization__c rm = mListCrew[0];

                    String mtQuery =
                        'SELECT id ' +
                        'FROM wfrecon__Mobilization_Member__c ' +
                        'WHERE ' +
                        '    wfrecon__Contact__c = :arg1 ' +
                        '    AND ((wfrecon__Mobilization__r.wfrecon__Start_Date__c <= :arg2 ' +
                        '    AND wfrecon__Mobilization__r.wfrecon__End_Date__c >= :arg3) ' +
                        '    OR (wfrecon__Mobilization__r.wfrecon__Start_Date__c <= :arg4 ' +
                        '    AND wfrecon__Mobilization__r.wfrecon__End_Date__c >= :arg5) ' +
                        '    OR (wfrecon__Mobilization__r.wfrecon__Start_Date__c >= :arg6 ' +
                        '    AND wfrecon__Mobilization__r.wfrecon__End_Date__c <= :arg7)) ' +
                        'WITH SECURITY_ENFORCED ' +
                        'LIMIT 1';
                    mtList = Lib_Security.ws()
                        .dbQuery(
                            mtQuery,
                            new List<Object>{
                                mtList[0].wfrecon__Contact__c,
                                rm.wfrecon__Start_Date__c,
                                rm.wfrecon__Start_Date__c,
                                rm.wfrecon__End_Date__c,
                                rm.wfrecon__End_Date__c,
                                rm.wfrecon__Start_Date__c,
                                rm.wfrecon__End_Date__c
                            }
                        );

                    if (mtList.size() == 0 || !chkOverlap) {
                        Lib_Security.ws().dbInsert(new List<wfrecon__Mobilization_Member__c>{ mTeamCrew });
                        Lib_Security.ws().dbDelete(new List<wfrecon__Mobilization_Member__c>{  mtList[0] });
                        return 'SUCCESS';
                    } else{
                        return 'Time Overlapping.';
                    }
                }
            }
        } else {
            wfrecon__Mobilization_Member__c mTeam = new wfrecon__Mobilization_Member__c(wfrecon__Contact__c = subConId, wfrecon__Mobilization__c = mobId);

            String mobQuery =
                'SELECT id, wfrecon__Start_Date__c, wfrecon__End_Date__c, wfrecon__Job__c FROM wfrecon__Mobilization__c ' +
                'WHERE id = :arg1 WITH SECURITY_ENFORCED';

            list<wfrecon__Mobilization__c> mList = Lib_Security.ws()
                .dbQuery(mobQuery, new List<Object>{ mobId});
            if (mList.size() > 0) {
                wfrecon__Mobilization__c rm = mList[0];
                String mlistQuery =
                    'SELECT id ' +
                    'FROM wfrecon__Mobilization_Member__c ' +
                    'WHERE ' +
                    '    wfrecon__Mobilization__c = :arg1 ' +
                    '    AND ((wfrecon__Mobilization__r.wfrecon__Start_Date__c <= :arg2 ' +
                    '    AND wfrecon__Mobilization__r.wfrecon__End_Date__c >= :arg3) ' +
                    '    OR (wfrecon__Mobilization__r.wfrecon__Start_Date__c <= :arg4 ' +
                    '    AND wfrecon__Mobilization__r.wfrecon__End_Date__c >= :arg5) ' +
                    '    OR (wfrecon__Mobilization__r.wfrecon__Start_Date__c >= :arg6 ' +
                    '    AND wfrecon__Mobilization__r.wfrecon__End_Date__c <= :arg7)) ' +
                    'WITH SECURITY_ENFORCED ' +
                    'LIMIT 1';

                mtList = Lib_Security.ws()
                    .dbQuery(
                        mlistQuery,
                        new List<Object>{
                            rm.Id,
                            rm.wfrecon__Start_Date__c,
                            rm.wfrecon__Start_Date__c,
                            rm.wfrecon__End_Date__c,
                            rm.wfrecon__End_Date__c,
                            rm.wfrecon__Start_Date__c,
                            rm.wfrecon__End_Date__c
                        }
                    );
                if (mtList.size() == 0 || !chkOverlap) {
                    Lib_Security.ws().dbUpsert(new List<wfrecon__Mobilization_Member__c>{ mTeam });
                    return 'SUCCESS';
                } else {
                    return 'Time Overlapping.';
                }
            }
        }
        return 'SUCCESS';
    }
    @AuraEnabled
    public static String AssignAsset(string assetId, string mobId, boolean chkOverlap) {
        String query =
            'SELECT id, Active__c ' +
            'FROM Mobilization_Asset__c ' +
            'WHERE id = :arg1 ' +
            'WITH SECURITY_ENFORCED';

        list<Mobilization_Asset__c> mtList = Lib_Security.ws().dbQuery(query, new List<Object>{ assetId });

        if (mtList.size() > 0) {
            if (mobId == 'delete') {
                Lib_Security.ws().dbDelete(mtList);
            } else {
                Mobilization_Asset__c assetUserId;
                String mAssetQuery =
                    'SELECT Equipment__c ' +
                    'FROM Mobilization_Asset__c ' +
                    'WHERE id = :arg1 ' +
                    'WITH SECURITY_ENFORCED';
                    if(SchedulerController.checkThirdLevelAccess()) {
                        assetUserId = (Mobilization_Asset__c) Lib_Security.ws()
                        .dbQuery(mAssetQuery, new List<Object>{ assetId })[0];      
                   }

                String mobQuery =
                    'SELECT id, Start_Date__c, End_Date__c, Job__c ' +
                    'FROM Mobilization__c ' +
                    'WHERE id = :arg1 ' +
                    'WITH SECURITY_ENFORCED';

                list<Mobilization__c> mList = Lib_Security.ws().dbQuery(mobQuery, new List<Object>{ mobId });

                if (mList.size() > 0 && SchedulerController.checkThirdLevelAccess()) {
                    Mobilization__c rm = mList[0];
                    String mAsQuery =
                        'SELECT id ' +
                        'FROM Mobilization_Asset__c ' +
                        'WHERE ' +
                        '    Equipment__c = :arg1 ' +
                        '    AND ((Mobilization__r.Start_Date__c <= :arg2 ' +
                        '    AND Mobilization__r.End_Date__c >= :arg3) ' +
                        '    OR (Mobilization__r.Start_Date__c <= :arg4 ' +
                        '    AND Mobilization__r.End_Date__c >= :arg5) ' +
                        '    OR (Mobilization__r.Start_Date__c >= :arg6 ' +
                        '    AND Mobilization__r.End_Date__c <= :arg7)) ' +
                        'WITH SECURITY_ENFORCED ' +
                        'LIMIT 1';

                    mtList = Lib_Security.ws()
                        .dbQuery(
                            mAsQuery,
                            new List<Object>{
                                assetUserId.Equipment__c,
                                rm.Start_Date__c,
                                rm.Start_Date__c,
                                rm.End_Date__c,
                                rm.End_Date__c,
                                rm.Start_Date__c,
                                rm.End_Date__c
                            }
                        );

                    if (mtList.size() == 0 || !chkOverlap) {
                        Mobilization_Asset__c mTeam = new Mobilization_Asset__c(
                            Equipment__c = assetUserId.Equipment__c,
                            Mobilization__c = mobId,
                            Active__c = true
                        );
                        Lib_Security.ws().dbInsert(new List<Mobilization_Asset__c>{ mTeam });
                        Lib_Security.ws().dbDelete(new List<Mobilization_Asset__c>{ assetUserId });
                        return 'SUCCESS';
                    } else {
                        return 'Time Overlapping.';
                    }
                }
            }
        } else {
            string prefix = Equipment__c.sobjecttype.getDescribe().getKeyPrefix();

            if (assetId.startsWith(prefix)) {
                String mobQuery =
                    'SELECT id, Start_Date__c, End_Date__c, Job__c ' +
                    'FROM Mobilization__c ' +
                    'WHERE id = :arg1 ' +
                    'WITH SECURITY_ENFORCED';

                list<Mobilization__c> mList = Lib_Security.ws().dbQuery(mobQuery, new List<Object>{ mobId });

                if (mList.size() > 0 && SchedulerController.checkThirdLevelAccess()) {
                    Mobilization__c rm = mList[0];
                    String mAsQuery =
                        'SELECT id ' +
                        'FROM Mobilization_Asset__c ' +
                        'WHERE ' +
                        '    Equipment__c = :arg1 ' +
                        '    AND ((Mobilization__r.Start_Date__c <= :arg2 ' +
                        '    AND Mobilization__r.End_Date__c >= :arg3) ' +
                        '    OR (Mobilization__r.Start_Date__c <= :arg4 ' +
                        '    AND Mobilization__r.End_Date__c >= :arg5) ' +
                        '    OR (Mobilization__r.Start_Date__c >= :arg6 ' +
                        '    AND Mobilization__r.End_Date__c <= :arg7)) ' +
                        'WITH SECURITY_ENFORCED ' +
                        'LIMIT 1';

                    mtList = Lib_Security.ws()
                        .dbQuery(
                            mAsQuery,
                            new List<Object>{
                                assetId,
                                rm.Start_Date__c,
                                rm.Start_Date__c,
                                rm.End_Date__c,
                                rm.End_Date__c,
                                rm.Start_Date__c,
                                rm.End_Date__c
                            }
                        );

                    if ((mtList.size() == 0 || !chkOverlap) && SchedulerController.checkThirdLevelAccess()) {
                        Mobilization_Asset__c mTeam = new Mobilization_Asset__c(
                            Equipment__c = assetId,
                            Mobilization__c = mobId,
                            Active__c = true
                        );
                        Lib_Security.ws().dbInsert(new List<Mobilization_Asset__c>{ mTeam });
                        return 'SUCCESS';
                    } else {
                        return 'Time Overlapping.';
                    }
                }
            } else {
                String moblQuery =
                    'SELECT id, Start_Date__c, End_Date__c, Job__c ' +
                    'FROM Mobilization__c ' +
                    'WHERE id = :arg1 ' +
                    'WITH SECURITY_ENFORCED';

                list<Mobilization__c> mList = Lib_Security.ws().dbQuery(moblQuery, new List<Object>{ mobId });

                if (mList.size() > 0 && SchedulerController.checkThirdLevelAccess()) {
                    Mobilization__c rm = mList[0];
                    String mAssetQuery =
                        'SELECT id ' +
                        'FROM Mobilization_Asset__c ' +
                        'WHERE ' +
                        '    Equipment__c = :arg1 ' +
                        '    AND ((Mobilization__r.Start_Date__c <= :arg2 ' +
                        '    AND Mobilization__r.End_Date__c >= :arg3) ' +
                        '    OR (Mobilization__r.Start_Date__c <= :arg4 ' +
                        '    AND Mobilization__r.End_Date__c >= :arg5) ' +
                        '    OR (Mobilization__r.Start_Date__c >= :arg6 ' +
                        '    AND Mobilization__r.End_Date__c <= :arg7)) ' +
                        'WITH SECURITY_ENFORCED ' +
                        'LIMIT 1';

                    mtList = Lib_Security.ws()
                        .dbQuery(
                            mAssetQuery,
                            new List<Object>{
                                assetId,
                                rm.Start_Date__c,
                                rm.Start_Date__c,
                                rm.End_Date__c,
                                rm.End_Date__c,
                                rm.Start_Date__c,
                                rm.End_Date__c
                            }
                        );

                    if ((mtList.size() == 0 || !chkOverlap) && SchedulerController.checkThirdLevelAccess()) {
                        String mQuery =
                            'SELECT id, Active__c, Mobilization__c, Equipment__c ' +
                            'FROM Mobilization_Asset__c ' +
                            'WHERE id = :arg1 ' +
                            'WITH SECURITY_ENFORCED';

                        Mobilization_Asset__c mTeam = (Mobilization_Asset__c) Lib_Security.ws()
                            .dbQuery(mQuery, new List<Object>{ assetId })[0];

                        mTeam.Active__c = false;

                        Mobilization_Asset__c mInsertTeam = mTeam.clone(false, false);
                        mInsertTeam.Active__c = true;

                        Lib_Security.ws().dbUpdate(new List<Mobilization_Asset__c>{ mTeam });
                        Lib_Security.ws().dbInsert(new List<Mobilization_Asset__c>{ mInsertTeam });

                        return 'SUCCESS';
                    } else {
                        return 'Time Overlapping.';
                    }
                }
            }
        }
        return 'SUCCESS';
    }

    public static List<User> getCrewUsers() {
        List<User> userList = new List<User>();
        String query =
            'SELECT Id, Name, User__c, User__r.Name ' +
            'FROM Contact ' +
            'WHERE User__r.IsActive = true AND User__r.Crew_User__c = true ' +
            'AND Is_Visible_On_Scheduler__c = TRUE ' +
            'WITH SECURITY_ENFORCED ' +
            'ORDER BY Name';

        List<Contact> contacts = Lib_Security.ws().dbQuery(query, new List<Object>{});
        for (Contact contact : contacts) {
            userList.add(contact.User__r);
        }
        return userList.isEmpty() ? new List<User>() : userList;
    }

    public static List<Contact> getSubContractors(){
        String query = 'SELECT Id, Name FROM Contact WHERE RecordType.DeveloperName = \'Sub_Contractor_WF_Recon\' AND Can_Log_In_Out__c = true AND Is_Visible_On_Scheduler__c = true';
        List<Contact> contacts = Lib_Security.ws().dbQuery(query, new List<Object>{});
        return contacts.isEmpty() ? new List<Contact>() : contacts;
    }
    public static List<Equipment__c> getCrewAssets() {
        String query =
            'SELECT Id, Name, Asset_Type__c  ' +
            'FROM Equipment__c ' +
            'WHERE Crew_Asset__c = true ' +
            'WITH SECURITY_ENFORCED ORDER BY Name';

        List<Equipment__c> assetList = Lib_Security.ws().dbQuery(query, new List<Object>{});
        return assetList.isEmpty() ? new List<Equipment__c>() : assetList;
    }

    public static DateTime getDefaultDateTime(DateTime dateTimeValue, String TimeValue) {
        // Split time part of string
        Integer colonpos = TimeValue.indexOf(':');
        Integer strLength = TimeValue.length();
        Integer hourValue = Integer.valueOf(TimeValue.substring(colonpos - 2, colonpos));
        Integer minuteValue = Integer.valueOf(TimeValue.substring(colonpos + 1, colonpos + 3));
        Integer secondValue = 0;
        String amORpm = TimeValue.substring(strLength - 2, strLength);

        hourValue = amORpm == 'PM' ? hourValue + 12 : hourValue;

        return datetime.newInstance(
            dateTimeValue.year(),
            dateTimeValue.month(),
            dateTimeValue.day(),
            hourValue,
            minuteValue,
            secondValue
        );
    }

    public static List<Mobilization__c> getMobilizations(
        List<string> statusList,
        Date startDate,
        Date endDate,
        String device
    ) {
        datetime startDateTime;
        datetime endDateTime;

        if (startDate != null) {
            date startDt = startDate.toStartOfWeek();
            startDateTime = datetime.newinstance(startdate.year(), startdate.month(), startdate.day(), 0, 0, 0);
            endDateTime = (datetime.newinstance(startDt.year(), startDt.month(), startDt.day(), 0, 0, 0)).addDays(7);
        } else {
            startDateTime = datetime.newinstance(
                System.today().year(),
                System.today().month(),
                System.today().day(),
                0,
                0,
                0
            );
        }

        if (endDate != null) {
            endDateTime = datetime.newinstance(endDate.year(), endDate.month(), endDate.day(), 23, 59, 59);
        } else {
            endDateTime = (datetime.newinstance(
                    System.today().year(),
                    System.today().month(),
                    System.today().day(),
                    23,
                    59,
                    59
                ))
                .addDays(7);
        }

        String queryString = 'SELECT Id, Name, Job__r.Job_Name__c, Job__r.Name, Job__c,Mobilization_Group__c, Mobilization_Name__c, Start_Date__c, End_Date__c, Mobilization_Status__c, Notes__c, toLabel(Mobilization_Status__c) mobStatus,';

        queryString =
            queryString +
            ' (SELECT Id, Name, Date_on_Site__c, Mobilization__c, Contact__c,wfrecon__Contact__r.Name,wfrecon__Contact__r.RecordType.DeveloperName,Contact__r.User__c, Contact__r.User__r.Name ' +
            ' FROM Mobilization_Members__r WHERE Contact__c != null ORDER BY Date_on_Site__c) ' +
            ' FROM Mobilization__c' +
            ' WHERE Start_Date__c != null AND End_Date__c != null';
        datetime startDateTimeRange;
        if (device == 'DESKTOP') {
            queryString = queryString + ' AND Start_Date__c >= :arg1 AND End_Date__c <= :arg2';
        } else {
            startDateTimeRange = datetime.newinstance(startdate.year(), startdate.month(), startdate.day(), 23, 59, 59);
            queryString = queryString + ' AND Start_Date__c >=: arg3 AND Start_Date__c <=: arg4';
        }

        queryString = !statusList.isEmpty()
            ? queryString + ' AND Mobilization_Status__c IN : arg5 WITH SECURITY_ENFORCED ORDER BY Start_Date__c'
            : queryString + ' WITH SECURITY_ENFORCED ORDER BY Start_Date__c';

        List<Mobilization__c> mobilizationList = Lib_Security.ws()
            .dbQuery(
                queryString,
                new List<Object>{ startDateTime, endDateTime, startDateTime, startDateTimeRange, statusList }
            );
        
        return mobilizationList;
    }

    // Wrapper Classes
    public class DateWiseWrapper {
        @AuraEnabled
        public Date jobDate;
        @AuraEnabled
        public String jobDateString;
        @AuraEnabled
        public DateTime jobDefaultStartDateTime;
        @AuraEnabled
        public DateTime jobDefaultEndDateTime;
        @AuraEnabled
        public List<CrewWrapper> crewList;
        @AuraEnabled
        public List<CrewWrapper> crewDisplayList;
        @AuraEnabled
        public List<SubContractorWrapper> subContractorList;
        @AuraEnabled
        public List<SubContractorWrapper> subContractorDisplayList;
        @AuraEnabled
        public List<String> subContractorIdList;
        @AuraEnabled
        public List<String> crewIdList;
        @AuraEnabled
        public List<AssetWrapper> assetList;
        @AuraEnabled
        public List<AssetWrapper> assetDisplayList;
        @AuraEnabled
        public List<String> assetIdList;
        @AuraEnabled
        public List<JobWrapper> jobWrapperList;
    }

    public class CrewWrapper implements Comparable {
        @AuraEnabled
        public string userId { get; set; }
        @AuraEnabled
        public string userName { get; set; }
        @AuraEnabled
        public boolean isSelected { get; set; }
        @AuraEnabled
        public Integer BinarySelected { get; set; }

        public CrewWrapper(string userId, string userName, boolean isSelected) {
            this.userId = userId;
            this.userName = userName;
            this.isSelected = isSelected;

            this.BinarySelected = isSelected ? 1 : 0;
        }

        // Compare
        public Integer compareTo(Object compareTo) {
            CrewWrapper compareToCrew = (CrewWrapper) compareTo;
            Integer returnValue = 0;

            if (BinarySelected > compareToCrew.BinarySelected) {
                returnValue = 1;
            } else if (BinarySelected < compareToCrew.BinarySelected) {
                returnValue = -1;
            }

            return returnValue;
        }
    }
    public class SubContractorWrapper implements Comparable {
        @AuraEnabled
        public string id { get; set; }
        @AuraEnabled
        public string name { get; set; }
        @AuraEnabled
        public boolean isSelected { get; set; }
        @AuraEnabled
        public Integer BinarySelected { get; set; }

        public SubContractorWrapper(string id, string name, boolean isSelected) {
            this.id = id;
            this.name = name;
            this.isSelected = isSelected;
            this.BinarySelected = isSelected ? 1 : 0;
        }

        // Compare
        public Integer compareTo(Object compareTo) {
            SubContractorWrapper compareToCrew = (SubContractorWrapper) compareTo;
            Integer returnValue = 0;

            if (BinarySelected > compareToCrew.BinarySelected) {
                returnValue = 1;
            } else if (BinarySelected < compareToCrew.BinarySelected) {
                returnValue = -1;
            }

            return returnValue;
        }
    }
    public class AssetWrapper implements Comparable {
        @AuraEnabled
        public string assetId;
        @AuraEnabled
        public string assetName;
        @AuraEnabled
        public boolean isSelected;
        @AuraEnabled
        public string assetType;
        @AuraEnabled
        public Integer BinarySelected;

        public AssetWrapper(string assetId, string assetName, boolean isSelected, string assetType) {
            this.assetId = assetId;
            this.assetName = assetName;
            this.isSelected = isSelected;
            this.assetType = assetType;

            this.BinarySelected = isSelected ? 1 : 0;
        }

        // Compare
        public Integer compareTo(Object compareTo) {
            AssetWrapper compareToAsset = (AssetWrapper) compareTo;
            Integer returnValue = 0;

            if (BinarySelected > compareToAsset.BinarySelected) {
                returnValue = 1;
            } else if (BinarySelected < compareToAsset.BinarySelected) {
                returnValue = -1;
            }

            return returnValue;
        }
    }

    public class JobWrapper {
        @AuraEnabled
        public String jobId;
        @AuraEnabled
        public String jobName;
        @AuraEnabled
        public String mobilizationId;
        @AuraEnabled
        public String mobilizationName;
        @AuraEnabled
        public String status;
        @AuraEnabled
        public String mobGroupId;
        //@AuraEnabled
        //public String divisionName;

        @AuraEnabled
        public String bgColor;
        @AuraEnabled
        public String textColor;

        @AuraEnabled
        public Date startDate;
        @AuraEnabled
        public Date endDate;
        @AuraEnabled
        public Datetime startDateTime;
        @AuraEnabled
        public Datetime endDateTime;

        @AuraEnabled
        public String startTime;
        @AuraEnabled
        public String endTime;
        @AuraEnabled
        public String notes;
        
        @AuraEnabled
        public String newCrewMemberId;
        @AuraEnabled
        public String newAssetMemberId;
        @AuraEnabled
        public String newSubConMemberId;
        @AuraEnabled
        public Boolean isSelected;

        @AuraEnabled
        public List<JobMemberWrapper> jobMemberList = new List<JobMemberWrapper>();
        @AuraEnabled
        public List<SubContractorMemberWrapper> subConMemberList = new List<SubContractorMemberWrapper>();
        @AuraEnabled
        public List<MobilizationAssetWrapper> mobAssetList = new List<MobilizationAssetWrapper>();

        public JobWrapper(
            String jobId,
            String jobName,
            String mobilizationId,
            String mobilizationName,
            String status,
            String statusLabel,
            String mobGroupId,
            //String divisionName,
            Date startDate,
            Date endDate,
            String startTime,
            String endTime,
            DateTime startDateTime,
            DateTime endDateTime,
            String notes,
            List<JobMemberWrapper> jobMemberList,
            List<SubContractorMemberWrapper> subConMemberList,
            List<MobilizationAssetWrapper> mobAssetList
        ) {
            this.jobId = jobId;
            this.jobName = jobName;
            this.mobilizationId = mobilizationId;
            this.mobilizationName = mobilizationName;

            this.startDateTime = startDateTime;
            this.endDateTime = endDateTime;
            this.notes = notes;
            this.status = status;
            this.mobGroupId = mobGroupId;
            //this.divisionName = divisionName;
            this.startTime = startTime;
            this.endTime = endTime;
            this.jobMemberList = jobMemberList;
            this.mobAssetList = mobAssetList;
            this.subConMemberList = subConMemberList;
            this.isSelected = false;

            this.newCrewMemberId = '';
            this.newAssetMemberId = '';
            this.newSubConMemberId = '';
            Schema.DescribeFieldResult fieldResult = Mobilization__c.Mobilization_Status__c.getDescribe();
            List<Schema.PicklistEntry> StatusList = fieldResult.getPicklistValues();

            try {
                this.bgColor = String.valueOf(Mobilization_Status_Color__c.getInstance(statusLabel).Background_Color__c);
                this.textColor = String.valueOf(Mobilization_Status_Color__c.getInstance(statusLabel).Color__c);
            } catch (Exception e) {
                this.bgColor = 'white';
                this.textColor = 'black';
            }
        }
    }

    public class JobMemberWrapper {
        @AuraEnabled
        public String memberId;
        @AuraEnabled
        public String userId;
        @AuraEnabled
        public String memberName;

        public JobMemberWrapper(String memberId, String memberName, String userId) {
            this.userId = userId;
            this.memberId = memberId;
            this.memberName = memberName;
        }
    }
    public class SubContractorMemberWrapper {
        @AuraEnabled
        public String memberId;
        @AuraEnabled
        public String subConId;
        @AuraEnabled
        public String memberName;

        public SubContractorMemberWrapper(String memberId, String memberName, String subConId) {
            this.subConId = subConId;
            this.memberId = memberId;
            this.memberName = memberName;
        }
    }

    public class MobilizationAssetWrapper {
        @AuraEnabled
        public String assetId;
        @AuraEnabled
        public String mobAssetId;
        @AuraEnabled
        public String assetName;
        @AuraEnabled
        public String assetType;
        @AuraEnabled
        public String assetBgColor;
        @AuraEnabled
        public String assetTextColor;

        public MobilizationAssetWrapper(String assetId, String mobAssetId, String assetName, String assetType) {
            this.assetId = assetId;
            this.mobAssetId = mobAssetId;
            this.assetName = assetName;
            this.assetType = assetType;

            if (assetType == 'Vehicle') {
                try {
                    assetBgColor = String.valueOf(
                        Mobilization_Status_Color__c.getInstance('Vehicle').Background_Color__c
                    );
                    assetTextColor = String.valueOf(Mobilization_Status_Color__c.getInstance('Vehicle').Color__c);
                } catch (Exception e) {
                    assetBgColor = 'White';
                    assetTextColor = 'black';
                }
            }
        }
    }

    public class defaultsWrapper {
        @AuraEnabled
        public String defaultStartTime;
        @AuraEnabled
        public String defaultEndTime;
        @AuraEnabled
        public DateTime defaultDate;
        @AuraEnabled
        public DateTime defaultEndDate;
        @AuraEnabled
        public String defaultStartDateTime;
        @AuraEnabled
        public String defaultEndDateTime;
        @AuraEnabled
        public String vehicleBackground;
        @AuraEnabled
        public String vehicleColor;
        @AuraEnabled
        public Boolean includeSaturday;
        @AuraEnabled
        public Boolean includeSunday;
        @AuraEnabled
        public List<PicklistValuesWrapper> jobStatusList;

        public defaultsWrapper() {
            try {
                this.vehicleBackground = String.valueOf(
                    Mobilization_Status_Color__c.getInstance('Vehicle').Background_Color__c
                );
                this.vehicleColor = String.valueOf(Mobilization_Status_Color__c.getInstance('Vehicle').Color__c);
            } catch (Exception e) {
                this.vehicleBackground = 'Black';
                this.vehicleColor = 'White';
            }
        }
    }
    public class PicklistValuesWrapper{
        @AuraEnabled
        public String label;
        @AuraEnabled
        public String apiName;
        
        public PicklistValuesWrapper() {}
        public PicklistValuesWrapper(String apiVal,String labelVal){
            this.label = labelVal;
            this.apiName = apiVal;
        }
    }
}