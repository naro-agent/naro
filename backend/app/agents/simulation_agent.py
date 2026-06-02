from app.schemas import UserProfile, SimulationResult, ScenarioResult, CashFlowPoint


def _build_scenario(profile: UserProfile, cost_multiplier: float) -> ScenarioResult:
    years_to_retire = profile.retirement_target_age - profile.age
    projection_years = 30

    monthly_pension = profile.national_pension_expected + profile.personal_pension
    data: list[CashFlowPoint] = []
    deficit_start_age = None
    deficit_months = 0

    for i in range(projection_years):
        current_age = profile.age + i
        year_events: list[str] = []
        extra_monthly_cost = 0

        for event in profile.life_events:
            if event.years_later == i:
                year_events.append(event.type)
            if event.years_later <= i < event.years_later + 4:
                extra_monthly_cost += int(event.monthly_cost * cost_multiplier)

        if profile.health_issue and current_age >= 65:
            extra_monthly_cost += int(300000 * cost_multiplier)

        if current_age < profile.retirement_target_age:
            income = profile.monthly_income
            base_expense = profile.monthly_expense + extra_monthly_cost
        else:
            income = monthly_pension
            base_expense = int(profile.monthly_target_living_cost * cost_multiplier) + extra_monthly_cost

        monthly_cf = income - base_expense
        is_deficit = monthly_cf < 0

        if is_deficit:
            deficit_months += 1
            if deficit_start_age is None:
                deficit_start_age = current_age

        data.append(CashFlowPoint(
            year=i,
            age=current_age,
            monthly_cash_flow=monthly_cf,
            is_deficit=is_deficit,
            events=year_events,
        ))

    scenario_name_map = {
        1.0: "neutral",
        0.8: "optimistic",
        1.3: "pessimistic",
    }

    return ScenarioResult(
        scenario=scenario_name_map.get(cost_multiplier, "neutral"),
        data=data,
        deficit_start_age=deficit_start_age,
        total_deficit_months=deficit_months,
    )


async def run_simulation(profile: UserProfile) -> SimulationResult:
    optimistic = _build_scenario(profile, 0.8)
    neutral = _build_scenario(profile, 1.0)
    pessimistic = _build_scenario(profile, 1.3)

    if neutral.deficit_start_age:
        key_msg = (
            f"중립 시나리오 기준, {neutral.deficit_start_age}세부터 월 현금흐름이 적자로 전환됩니다. "
            f"비관적 시나리오에서는 총 {pessimistic.total_deficit_months}개월 동안 적자가 지속될 수 있습니다."
        )
    else:
        key_msg = (
            f"낙관 시나리오 기준 현금흐름이 전체 기간 흑자를 유지합니다. "
            f"비관적 시나리오에도 대비한 완충 자산 확보를 권장합니다."
        )

    return SimulationResult(
        optimistic=optimistic,
        neutral=neutral,
        pessimistic=pessimistic,
        key_risk_message=key_msg,
    )
