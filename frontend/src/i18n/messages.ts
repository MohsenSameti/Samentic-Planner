const englishMessages = {
  language: 'Language', english: 'English', persian: 'فارسی', theme: 'Theme',
  startOfWeek: 'Start of week', calendar: 'Calendar', gregorian: 'Gregorian', jalali: 'Jalali', light: 'Light', dark: 'Dark', system: 'System',
  'Planner': 'Planner', 'Projects': 'Projects', 'Custom Properties': 'Custom Properties', 'Weekly Totals': 'Weekly Totals', 'Week Summary': 'Week Summary',
  'Settings': 'Settings', 'Today': 'Today', 'Change password': 'Change password', 'Changing password…': 'Changing password…', 'New password must be at least 8 characters.': 'New password must be at least 8 characters.',
  'Log out': 'Log out', 'Toggle menu': 'Toggle menu', 'All Tasks': 'All Tasks', 'Edit': 'Edit',
  'No trackers yet.': 'No trackers yet.', 'Add Property': 'Add Property', 'Add Project': 'Add Project', 'Edit project': 'Edit project', 'Edit property': 'Edit property',
  'Week navigation': 'Week navigation', 'Previous week': 'Previous week', 'Next week': 'Next week',
  'Back to week': 'Back to week', 'Week': 'Week', 'Previous day': 'Previous day', 'Next day': 'Next day',
  'Tasks': 'Tasks', 'Add task': 'Add task', 'No tasks for this day': 'No tasks for this day',
  'Day Properties': 'Day Properties', 'Day Notes': 'Day Notes', 'Week Notes': 'Week Notes', 'Day details': 'Day details', 'Notes': 'Notes',
  'Completed': 'Completed', 'Active': 'Active', 'Skipped': 'Skipped', 'Cancelled': 'Cancelled', 'done': 'done', 'active': 'active', 'skipped': 'skipped', 'cancelled': 'cancelled',
  'Filtered by:': 'Filtered by:', 'Clear filter': 'Clear filter',
  'Something went wrong': 'Something went wrong', 'Try Again': 'Try Again', 'The planner is not responding. Try again?': 'The planner is not responding. Try again?',
  'Create your password': 'Create your password', 'Choose a strong password to secure your planner.': 'Choose a strong password to secure your planner.',
  'Password': 'Password', 'Confirm password': 'Confirm password', 'Open planner': 'Open planner',
  'Current password': 'Current password', 'New password': 'New password', 'Confirm new password': 'Confirm new password',
  'Cancel': 'Cancel', 'Delete': 'Delete', 'Move to': 'Move to', 'Move': 'Move', 'Name': 'Name', 'Unit': 'Unit', 'Edit Task': 'Edit Task', 'Add Task': 'Add Task', 'Edit Project': 'Edit Project', 'Add Project Modal': 'Add Project', 'Edit Property': 'Edit Property', 'Add Property Modal': 'Add Property', 'Delete confirmation': 'Delete confirmation', 'Move Task': 'Move Task', 'Confirm Delete': 'Confirm Delete',
  'Color': 'Color', 'Save': 'Save', 'Task': 'Task', 'Description': 'Description', 'Project': 'Project',
  'No project': 'No project', 'General': 'General', 'Date': 'Date', 'e.g., Hours, Pages': 'e.g., Hours, Pages', 'e.g., hrs, km': 'e.g., hrs, km',
  'Project name': 'Project name', 'What needs to be done?': 'What needs to be done?',
  'Add a description...': 'Add a description...', 'Add notes...': 'Add notes...',
  'Add notes about this week...': 'Add notes about this week...', 'Add notes for this day...': 'Add notes for this day...',
  'Date picker': 'Date picker', 'Pick a date': 'Pick a date', 'Previous month': 'Previous month',
  'Next month': 'Next month', 'Dismiss notification': 'Dismiss notification', 'Dismiss error': 'Dismiss error',
  'Close': 'Close', 'Year': 'Year', 'Month': 'Month', 'Day': 'Day', 'leap': 'leap',
  'Jalali year': 'Jalali year', 'Jalali month': 'Jalali month', 'Jalali day': 'Jalali day',
  'The planner isn’t responding. Try again?': 'The planner isn’t responding. Try again?',
  'Opening planner…': 'Opening planner…', 'Retry': 'Retry', 'An unknown error occurred.': 'An unknown error occurred.', 'Something went wrong. Try again.': 'Something went wrong. Try again.', 'Could not load planner': 'Could not load planner', 'Password changed successfully.': 'Password changed successfully.',
  'Language preference': 'Language preference', 'Couldn’t reach server. Please check your connection.': 'Couldn’t reach server. Please check your connection.', "Couldn't reach server. Please check your connection.": "Couldn't reach server. Please check your connection.", 'Network error. Please check your connection.': 'Network error. Please check your connection.', 'Show day details': 'Show day details', 'Hide day details': 'Hide day details', 'has note': 'has note', 'Current view': 'Current view', 'Click to reset': 'Click to reset', 'Task actions': 'Task actions', 'Add a task to': 'Add a task to', 'Open': 'Open', 'Hide Notes': 'Hide Notes', 'Add Notes': 'Add Notes', 'Move to...': 'Move to...', 'Skip': 'Skip', 'Unskip': 'Unskip', 'Restore': 'Restore', 'Mark': 'Mark', 'complete': 'complete', 'incomplete': 'incomplete', 'Opening…': 'Opening…', 'Create password': 'Create password', 'Creating password…': 'Creating password…', 'Saving…': 'Saving…', 'Saved': 'Saved', 'Save failed': 'Save failed',
  'Password must be at least 8 characters.': 'Password must be at least 8 characters.', 'Passwords do not match.': 'Passwords do not match.', 'Invalid password': 'Invalid password', 'Current password is incorrect': 'Current password is incorrect', 'Password is required': 'Password is required', 'Current password is required': 'Current password is required', 'No password set': 'No password set', 'Password must be at least 8 characters': 'Password must be at least 8 characters', 'New password must be at least 8 characters': 'New password must be at least 8 characters',
} as const

export type MessageKey = keyof typeof englishMessages

const persianMessages: Record<MessageKey, string> = {
  language: 'زبان', english: 'English', persian: 'فارسی', theme: 'پوسته',
  startOfWeek: 'شروع هفته', calendar: 'تقویم', gregorian: 'میلادی', jalali: 'جلالی', light: 'روشن', dark: 'تیره', system: 'سیستم',
  'Planner': 'برنامه‌ریز', 'Projects': 'پروژه‌ها', 'Custom Properties': 'ویژگی‌های سفارشی', 'Weekly Totals': 'مجموع هفتگی', 'Week Summary': 'خلاصهٔ هفته',
  'Settings': 'تنظیمات', 'Today': 'امروز', 'Change password': 'تغییر گذرواژه', 'Changing password…': 'در حال تغییر گذرواژه…', 'New password must be at least 8 characters.': 'گذرواژهٔ جدید باید دست‌کم 8 نویسه داشته باشد.',
  'Log out': 'خروج', 'Toggle menu': 'باز و بسته کردن منو', 'All Tasks': 'همهٔ کارها', 'Edit': 'ویرایش',
  'No trackers yet.': 'هنوز پیگیری‌کننده‌ای وجود ندارد.', 'Add Property': 'افزودن ویژگی', 'Add Project': 'افزودن پروژه', 'Edit project': 'ویرایش پروژه', 'Edit property': 'ویرایش ویژگی',
  'Week navigation': 'پیمایش هفته', 'Previous week': 'هفتهٔ قبل', 'Next week': 'هفتهٔ بعد',
  'Back to week': 'بازگشت به هفته', 'Week': 'هفته', 'Previous day': 'روز قبل', 'Next day': 'روز بعد',
  'Tasks': 'کارها', 'Add task': 'افزودن کار', 'No tasks for this day': 'برای این روز کاری ثبت نشده است',
  'Day Properties': 'ویژگی‌های روز', 'Day Notes': 'یادداشت‌های روز', 'Week Notes': 'یادداشت‌های هفته', 'Day details': 'جزئیات روز', 'Notes': 'یادداشت‌ها',
  'Completed': 'انجام‌شده', 'Active': 'در حال انجام', 'Skipped': 'به‌تعویق‌افتاده', 'Cancelled': 'لغوشده', 'done': 'انجام‌شده', 'active': 'در حال انجام', 'skipped': 'به‌تعویق‌افتاده', 'cancelled': 'لغوشده',
  'Filtered by:': 'فیلترشده بر اساس:', 'Clear filter': 'پاک‌کردن فیلتر',
  'Something went wrong': 'مشکلی پیش آمد', 'Try Again': 'تلاش دوباره', 'The planner is not responding. Try again?': 'برنامه‌ریز پاسخ نمی‌دهد. دوباره تلاش می‌کنید؟',
  'Create your password': 'گذرواژه‌تان را بسازید', 'Choose a strong password to secure your planner.': 'برای امن‌کردن برنامه‌ریز، گذرواژه‌ای قوی انتخاب کنید.',
  'Password': 'گذرواژه', 'Confirm password': 'تأیید گذرواژه', 'Open planner': 'ورود به برنامه‌ریز',
  'Current password': 'گذرواژهٔ فعلی', 'New password': 'گذرواژهٔ جدید', 'Confirm new password': 'تأیید گذرواژهٔ جدید',
  'Cancel': 'انصراف', 'Delete': 'حذف', 'Move to': 'انتقال به', 'Move': 'انتقال', 'Name': 'نام', 'Unit': 'واحد', 'Edit Task': 'ویرایش کار', 'Add Task': 'افزودن کار', 'Edit Project': 'ویرایش پروژه', 'Add Project Modal': 'افزودن پروژه', 'Edit Property': 'ویرایش ویژگی', 'Add Property Modal': 'افزودن ویژگی', 'Delete confirmation': 'تأیید حذف', 'Move Task': 'انتقال کار', 'Confirm Delete': 'تأیید حذف',
  'Color': 'رنگ', 'Save': 'ذخیره', 'Task': 'کار', 'Description': 'توضیحات', 'Project': 'پروژه',
  'No project': 'بدون پروژه', 'General': 'عمومی', 'Date': 'تاریخ', 'e.g., Hours, Pages': 'مثلاً ساعت، صفحه', 'e.g., hrs, km': 'مثلاً ساعت، کیلومتر',
  'Project name': 'نام پروژه', 'What needs to be done?': 'چه کاری باید انجام شود؟',
  'Add a description...': 'توضیحی اضافه کنید...', 'Add notes...': 'یادداشتی اضافه کنید...',
  'Add notes about this week...': 'یادداشتی دربارهٔ این هفته بنویسید...', 'Add notes for this day...': 'یادداشتی برای این روز بنویسید...',
  'Date picker': 'انتخاب تاریخ', 'Pick a date': 'انتخاب تاریخ', 'Previous month': 'ماه قبل',
  'Next month': 'ماه بعد', 'Dismiss notification': 'بستن اعلان', 'Dismiss error': 'بستن خطا',
  'Close': 'بستن', 'Year': 'سال', 'Month': 'ماه', 'Day': 'روز', 'leap': 'کبیسه',
  'Jalali year': 'سال جلالی', 'Jalali month': 'ماه جلالی', 'Jalali day': 'روز جلالی',
  'The planner isn’t responding. Try again?': 'برنامه‌ریز پاسخ نمی‌دهد. دوباره تلاش می‌کنید؟',
  'Opening planner…': 'در حال بازکردن برنامه‌ریز…', 'Retry': 'تلاش دوباره', 'An unknown error occurred.': 'خطای ناشناخته‌ای رخ داد.', 'Something went wrong. Try again.': 'مشکلی پیش آمد. دوباره تلاش کنید.', 'Could not load planner': 'بارگذاری برنامه‌ریز انجام نشد', 'Password changed successfully.': 'گذرواژه با موفقیت تغییر کرد.',
  'Language preference': 'زبان برنامه', 'Couldn’t reach server. Please check your connection.': 'ارتباط با سرور برقرار نشد. اتصال اینترنت را بررسی کنید.', "Couldn't reach server. Please check your connection.": 'ارتباط با سرور برقرار نشد. اتصال اینترنت را بررسی کنید.', 'Network error. Please check your connection.': 'خطای شبکه. اتصال اینترنت را بررسی کنید.', 'Show day details': 'نمایش جزئیات روز', 'Hide day details': 'پنهان‌کردن جزئیات روز', 'has note': 'دارای یادداشت', 'Current view': 'نمای فعلی', 'Click to reset': 'برای بازنشانی کلیک کنید', 'Task actions': 'عملیات کار', 'Add a task to': 'افزودن کار به', 'Open': 'باز کردن', 'Hide Notes': 'پنهان‌کردن یادداشت‌ها', 'Add Notes': 'افزودن یادداشت', 'Move to...': 'انتقال به…', 'Skip': 'تعویق', 'Unskip': 'لغو تعویق', 'Restore': 'بازیابی', 'Mark': 'علامت‌گذاری به‌عنوان', 'complete': 'انجام‌شده', 'incomplete': 'انجام‌نشده', 'Opening…': 'در حال ورود…', 'Create password': 'ساخت گذرواژه', 'Creating password…': 'در حال ساخت گذرواژه…', 'Saving…': 'در حال ذخیره…', 'Saved': 'ذخیره شد', 'Save failed': 'ذخیره انجام نشد',
  'Password must be at least 8 characters.': 'گذرواژه باید دست‌کم 8 نویسه داشته باشد.', 'Passwords do not match.': 'گذرواژه‌ها یکسان نیستند.', 'Invalid password': 'گذرواژه نادرست است', 'Current password is incorrect': 'گذرواژهٔ فعلی نادرست است', 'Password is required': 'واردکردن گذرواژه الزامی است', 'Current password is required': 'واردکردن گذرواژهٔ فعلی الزامی است', 'No password set': 'گذرواژه‌ای تنظیم نشده است', 'Password must be at least 8 characters': 'گذرواژه باید دست‌کم 8 نویسه داشته باشد', 'New password must be at least 8 characters': 'گذرواژهٔ جدید باید دست‌کم 8 نویسه داشته باشد',
}

const catalogs: Record<'en' | 'fa', Record<MessageKey, string>> = {
  en: englishMessages,
  fa: persianMessages,
}

const englishKeyLookup = new Map<string, MessageKey>()
for (const key of Object.keys(englishMessages) as MessageKey[]) {
  englishKeyLookup.set(key, key)
}

export function translate(language: 'en' | 'fa', key: MessageKey): string {
  return catalogs[language][key]
}

export function translateText(language: 'en' | 'fa', source: string): string {
  const key = englishKeyLookup.get(source)
  return key ? catalogs[language][key] : source
}

export function formatDeleteProjectConfirm(
  language: 'en' | 'fa',
  projectName: string,
  taskCount: number,
): string {
  if (language === 'fa') {
    return taskCount > 0
      ? `پروژهٔ «${projectName}» حذف شود؟ ${taskCount} کار بدون پروژه می‌ماند.`
      : `پروژهٔ «${projectName}» حذف شود؟`
  }
  return taskCount > 0
    ? `Delete "${projectName}"? ${taskCount} tasks will be moved to no project.`
    : `Delete "${projectName}"?`
}

export function formatDeletePropertyConfirm(
  language: 'en' | 'fa',
  propertyName: string,
): string {
  if (language === 'fa') {
    return `ویژگی «${propertyName}» حذف شود؟ همهٔ مقادیر آن پاک می‌شوند.`
  }
  return `Delete "${propertyName}"? All values will be removed.`
}
