export const dynamic = "force-dynamic";

function Section({ icon, en, zh, children }: { icon: string; en: string; zh: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-base">{icon}</span>
        <span>{en} <span className="text-slate-400">/ {zh}</span></span>
      </h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-600">{children}</div>
    </section>
  );
}

// A numbered step: [titleEN, titleZH, bodyEN, bodyZH]
function Steps({ items }: { items: [string, string, string, string][] }) {
  return (
    <ol className="space-y-3">
      {items.map(([kEn, kZh, vEn, vZh], i) => (
        <li key={i} className="flex gap-3">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-medium text-accent">{i + 1}</span>
          <span>
            <strong className="text-slate-900">{kEn} / {kZh}.</strong> {vEn}
            <span className="mt-0.5 block text-slate-500">{vZh}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

// A "when this happens → do this" scenario card.
function When({ sitEn, sitZh, doEn, doZh }: { sitEn: string; sitZh: string; doEn: string; doZh: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="font-medium text-slate-900">⚠️ {sitEn} <span className="text-slate-400">/ {sitZh}</span></p>
      <p className="mt-1 text-sm text-slate-600">✅ {doEn}</p>
      <p className="mt-0.5 text-sm text-slate-500">✅ {doZh}</p>
    </div>
  );
}

export default function HandbookPage() {
  return (
    <section className="max-w-3xl pb-16">
      <h1 className="text-2xl font-semibold">Operator Handbook <span className="text-slate-400">/ 操作手册</span></h1>
      <p className="mt-1 text-sm text-slate-500">Every step, and what to do in each situation. / 每个步骤，以及每种情况该如何处理。</p>

      <Section icon="📥" en="1. A new enquiry arrives" zh="1. 收到新询问">
        <Steps items={[
          ["Find it in Leads", "在「询问」中查看", "Every web form / WhatsApp enquiry appears in Leads with a reference number and the customer's reference images.", "每个网站表格或 WhatsApp 询问都会出现在「询问」中，附编号与客户的参考图片。"],
          ["Read the details", "查看详情", "Open the lead to see event type, date, venue, guests, budget, theme and any special requests.", "打开询问查看活动类型、日期、地点、人数、预算、主题与特别要求。"],
          ["Set the status", "设置状态", "Use the status dropdown to move it: New → Reviewing once you're working on it.", "用状态下拉框更新：新 → 审核中（当你开始处理时）。"],
          ["Need more photos?", "需要更多照片？", "Use the 'Request more photos' card — share the password link + code so the customer uploads straight onto the lead.", "使用「索取更多照片」卡片，把密码链接与访问码发给客户，让他们直接上传到此询问。"],
        ]} />
      </Section>

      <Section icon="📝" en="2. Build the quotation / proposal" zh="2. 制作报价 / 方案">
        <Steps items={[
          ["Create a quote", "创建报价", "On the lead, click '+ Create quotation' (or Quotations → + New quotation to pick a company).", "在询问页点击「+ 创建报价」（或在「报价」点「+ 新报价」选择公司）。"],
          ["AI or manual", "AI 或手动", "Click '✨ Generate with AI' to draft priced lines from the images (needs an OpenAI key), or add lines by hand. Both are fully editable.", "点「✨ AI 生成」从图片生成定价项目（需 OpenAI 密钥），或手动添加项目。两者皆可编辑。"],
          ["Use packages", "使用配套", "Use '+ Add from package' to drop a saved package's name + price as a line.", "用「+ 从配套添加」把已存配套的名称与价格作为一项加入。"],
          ["Price each line", "为每项定价", "Cost → profit % → selling price. Set a default profit % and override per line. Toggle SST (only for SST-registered companies).", "成本 → 利润 % → 售价。可设默认利润 %，每项可覆盖。可开关 SST（仅限已注册 SST 的公司）。"],
          ["Add design photos", "添加设计照片", "Upload design / reference photos under 'Design / reference images' — they show on the customer's proposal.", "在「设计 / 参考图片」上传照片，会显示在客户的方案上。"],
          ["Fill event details", "填写活动详情", "Set Prepared by, event date, setup / start / dismantle time and venue — these print on the document.", "填写制作人、活动日期、布置/开始/拆除时间与地点，这些会印在文件上。"],
          ["Preview & send", "预览并发送", "Click Preview to check the A4 document, then 'Send proposal' — it makes a 6-digit access code and shows the link to share.", "点「预览」查看 A4 文件，再点「发送方案」，系统会生成 6 位访问码并显示可分享的链接。"],
        ]} />
      </Section>

      <Section icon="👀" en="3. Customer reviews the proposal" zh="3. 客户查看方案">
        <Steps items={[
          ["They open the link", "打开链接", "Customer enters the access code, then sees the proposal with photos, line items, total and deposit.", "客户输入访问码后，看到含照片、项目、总额与订金的方案。"],
          ["Accept & Proceed", "接受并继续", "If happy, they click 'Accept & Proceed to Payment' → a Booking is created and deposit instructions appear.", "若满意，点「接受并付款」→ 生成预订并显示付款说明。"],
          ["Request Changes", "要求修改", "If they want changes, they write feedback + upload photos. It lands in your BO and pre-fills the AI prompt.", "若要修改，他们填写反馈并上传照片。反馈会进入后台并预填 AI 提示。"],
        ]} />
      </Section>

      <Section icon="💰" en="4. Payment &amp; invoice" zh="4. 付款与发票">
        <Steps items={[
          ["Customer pays deposit", "客户付订金", "They transfer / DuitNow the deposit and upload the payment proof on the quote page.", "客户转账/DuitNow 支付订金，并在报价页上传付款凭证。"],
          ["You confirm it", "你确认付款", "Bookings → open the booking → Confirm payment. This issues a printable invoice and starts planning.", "「预订」→ 打开预订 → 确认付款。系统开出可打印发票并开始策划。"],
          ["Collect the balance", "收取余额", "Before the event, collect the remaining balance, record it and confirm. The booking shows a next-step guide.", "活动前收取余额、记录并确认。预订页会显示下一步指引。"],
        ]} />
      </Section>

      <Section icon="📋" en="5. Plan &amp; deliver the event" zh="5. 策划与执行活动">
        <Steps items={[
          ["Open Planning", "打开策划", "The event appears in Planning and on the Calendar. Open its board.", "活动会出现在「策划」与「日历」。打开它的面板。"],
          ["Work the checklist", "完成清单", "Tick checklist tasks, add the run-sheet (timings), and assign suppliers with their cost.", "勾选清单任务，添加流程表（时间），并分配供应商及其成本。"],
          ["Watch the budget", "关注预算", "Event value − supplier cost = margin. Keep it healthy.", "活动金额 − 供应商成本 = 利润。保持健康。"],
          ["Add a venue", "添加地点", "In the booking form, search a venue (with map) or pick a saved one — new venues are saved automatically.", "在预订表格中搜索地点（含地图）或选择已存地点，新地点会自动保存。"],
        ]} />
      </Section>

      <Section icon="🧭" en="Situations &amp; how to handle them" zh="常见情况与处理方法">
        <When sitEn="Customer requested changes" sitZh="客户要求修改" doEn="Open the quote — their feedback shows in an amber banner and is pre-filled in the AI prompt. Adjust, click Generate (or edit by hand), then 'Resend with new code' to send a new version — the customer's old access code stops working." doZh="打开报价 — 反馈显示在橙色横幅中并预填到 AI 提示。调整后点「生成」（或手动编辑），再点「重新发送（新验证码）」发送新版本——客户旧的访问码将失效。" />
        <When sitEn="Customer went quiet / not paying" sitZh="客户没回应 / 未付款" doEn="The booking stays 'awaiting deposit'. Follow up via WhatsApp. If it falls through, set the lead to Lost." doZh="预订维持「等待订金」。通过 WhatsApp 跟进。若不成，把询问设为「流失」。" />
        <When sitEn="A payment proof was uploaded" sitZh="客户上传了付款凭证" doEn="Bookings → open it → check the proof image → Confirm payment. The first deposit issues the invoice and starts planning." doZh="「预订」→ 打开 → 检查凭证图片 → 确认付款。首次订金会开出发票并开始策划。" />
        <When sitEn="WhatsApp bot is chatting with a customer" sitZh="WhatsApp 机器人正在与客户对话" doEn="The thread shows a '🤖 bot is handling this' banner. To take over, click 'Take over' or just reply — that stops the bot." doZh="对话会显示「🤖 机器人处理中」横幅。要接手，点「接手」或直接回复，机器人即停止。" />
        <When sitEn="A walk-in / phone booking (no web enquiry)" sitZh="到店 / 电话预订（无网站询问）" doEn="Use '+ New booking' on Bookings or Planning to create it manually with the venue and amount." doZh="在「预订」或「策划」点「+ 新预订」，手动输入地点与金额创建。" />
        <When sitEn="Need to edit an issued invoice" sitZh="需要修改已开出的发票" doEn="Invoices → open it → Edit invoice. Change lines / customer / SST; totals and balance recompute automatically." doZh="「发票」→ 打开 → 编辑发票。修改项目/客户/SST，总额与余额会自动重算。" />
        <When sitEn="Customer prefers WhatsApp over the web form" sitZh="客户偏好用 WhatsApp 而非网站表格" doEn="They just message your WhatsApp number — the enquiry bot asks the event questions and creates the lead automatically." doZh="客户只需私信你的 WhatsApp 号码，询问机器人会自动询问活动问题并生成询问。" />
        <When sitEn="Saving a PDF of a quote / invoice" sitZh="保存报价 / 发票的 PDF" doEn="Open the document → 'Save as PDF'. It prints to A4; Terms and design photos flow onto page 2/3 in one PDF." doZh="打开文件 → 「保存为 PDF」。按 A4 打印；条款与设计照片会延续到第 2/3 页，合成一个 PDF。" />
      </Section>

      <Section icon="👥" en="Roles &amp; access" zh="角色与权限">
        <ul className="list-disc space-y-1.5 pl-5">
          <li><strong className="text-slate-900">Super-admin / 超级管理员</strong> — all companies, group reports, create/edit companies. 所有公司、报表、创建/编辑公司。</li>
          <li><strong className="text-slate-900">Company admin / 公司管理员</strong> — own company: settings, staff, leads, quotes, invoices, planning. 自己的公司：设置、员工、询问、报价、发票、策划。</li>
          <li><strong className="text-slate-900">Sales / 销售</strong> — leads, quotations, invoices, packages. 询问、报价、发票、配套。</li>
          <li><strong className="text-slate-900">Planner / 策划员</strong> — the planning board only. 仅限策划面板。</li>
        </ul>
      </Section>

      <Section icon="⚙️" en="Set up &amp; switches" zh="设置与切换">
        <p>Companies → New company: branding, SST, bank + DuitNow QR, profit %, prefixes, T&amp;C, OpenAI key, WhatsApp, custom domain. / 公司 → 新公司：品牌、SST、银行 + DuitNow QR、利润 %、前缀、条款、OpenAI 密钥、WhatsApp、自定义域名。</p>
        <p>Switch the whole back office between <strong className="text-slate-900">English / 中文</strong> with the top-right selector. Add staff under Staff. / 用右上角选择器切换整个后台 <strong className="text-slate-700">English / 中文</strong>。在「员工」添加同事。</p>
      </Section>
    </section>
  );
}
