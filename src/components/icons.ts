// 피그마에서 내보낸 SVG 아이콘. 색이 SVG에 박혀 있어 활성/비활성 색은 별도 파일이거나 color prop으로 덮어씁니다.
import AnalysisBackdrop from "@/assets/icons/analysis-backdrop-circle.svg";
import AnalysisRoute from "@/assets/icons/analysis-quiet-route.svg";
import ArrowRight from "@/assets/icons/icon-arrow-right.svg";
import Back from "@/assets/icons/icon-back.svg";
import Bell from "@/assets/icons/icon-bell.svg";
import Calendar18 from "@/assets/icons/icon-calendar-18.svg";
import CalendarSummary from "@/assets/icons/icon-calendar-summary.svg";
import CalendarSurvey from "@/assets/icons/icon-calendar-survey.svg";
import CalendarTask from "@/assets/icons/icon-calendar-task.svg";
import CheckExclusion from "@/assets/icons/icon-check-exclusion.svg";
import CheckFriend from "@/assets/icons/icon-check-friend.svg";
import CheckSelected from "@/assets/icons/icon-check-selected.svg";
import CheckTag from "@/assets/icons/icon-check-tag.svg";
import CheckTask from "@/assets/icons/icon-check-task.svg";
import ChevronRight from "@/assets/icons/icon-chevron-right.svg";
import ChevronRightBlue from "@/assets/icons/icon-chevron-right-blue.svg";
import ChevronUp from "@/assets/icons/icon-chevron-up.svg";
import Close from "@/assets/icons/icon-close.svg";
import Copy from "@/assets/icons/icon-copy.svg";
import MonthNext from "@/assets/icons/icon-month-next.svg";
import MonthPrev from "@/assets/icons/icon-month-prev.svg";
import NavHome from "@/assets/icons/icon-nav-home.svg";
import NavHomeActive from "@/assets/icons/icon-nav-home-active.svg";
import NavSave from "@/assets/icons/icon-nav-save.svg";
import NavSaveActive from "@/assets/icons/icon-nav-save-active.svg";
import NavTrip from "@/assets/icons/icon-nav-trip.svg";
import NavTripActive from "@/assets/icons/icon-nav-trip-active.svg";
import NavUser from "@/assets/icons/icon-nav-user.svg";
import NavUserActive from "@/assets/icons/icon-nav-user-active.svg";
import People from "@/assets/icons/icon-people.svg";
import Pin16 from "@/assets/icons/icon-pin-16.svg";
import PinBlue20 from "@/assets/icons/icon-pin-blue-20.svg";
import PinButton from "@/assets/icons/icon-pin-button.svg";
import PinDarkgreen20 from "@/assets/icons/icon-pin-darkgreen-20.svg";
import Refresh from "@/assets/icons/icon-refresh.svg";
import Share from "@/assets/icons/icon-share.svg";
import Spark from "@/assets/icons/icon-spark.svg";
import LogoPin from "@/assets/icons/logo-pin.svg";
import MotiveCompanion from "@/assets/icons/motive-companion.svg";
import MotiveEscape from "@/assets/icons/motive-escape.svg";
import MotiveHistory from "@/assets/icons/motive-history.svg";
import MotiveNewExperience from "@/assets/icons/motive-new-experience.svg";
import MotiveRest from "@/assets/icons/motive-rest.svg";
import MotiveWellness from "@/assets/icons/motive-wellness.svg";
import OnbBack from "@/assets/icons/onb-icon-back-arrow.svg";
import PinDestination from "@/assets/icons/pin-destination.svg";
import SelectedAreaGlow from "@/assets/icons/selected-area-glow.svg";

export const Icons = {
  AnalysisBackdrop,
  AnalysisRoute,
  ArrowRight,
  Back,
  Bell,
  Calendar18,
  CalendarSummary,
  CalendarSurvey,
  CalendarTask,
  CheckExclusion,
  CheckFriend,
  CheckSelected,
  CheckTag,
  CheckTask,
  ChevronRight,
  ChevronRightBlue,
  ChevronUp,
  Close,
  Copy,
  LogoPin,
  MonthNext,
  MonthPrev,
  MotiveCompanion,
  MotiveEscape,
  MotiveHistory,
  MotiveNewExperience,
  MotiveRest,
  MotiveWellness,
  NavHome,
  NavHomeActive,
  NavSave,
  NavSaveActive,
  NavTrip,
  NavTripActive,
  NavUser,
  NavUserActive,
  OnbBack,
  People,
  Pin16,
  PinBlue20,
  PinButton,
  PinDarkgreen20,
  PinDestination,
  Refresh,
  SelectedAreaGlow,
  Share,
  Spark,
} as const;

export type IconName = keyof typeof Icons;
