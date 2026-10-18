export default function HandsFree() {
  return (
    <section className="band wrap" id="why" data-n="06" data-t="Hands free" aria-label="Why hush.">
      <div className="head">
        <div>
          <div className="mono">Why hush.</div>
          <h2>
            Keep your hands <em>on your work</em>
            <span className="o">.</span>
          </h2>
        </div>
        <p>Your Tune has great features. Getting to them should not mean taking your hands off the keyboard.</p>
      </div>
      <div className="vs">
        <div className="col before">
          <div className="mono">The old way, switching modes meant</div>
          <ol>
            <li>Stop typing to reach for the earcup.</li>
            <li>Hunt for the button by feel.</li>
            <li>Press it and wait for the tone.</li>
            <li>Press again if it picked the wrong mode.</li>
            <li>Or unlock your phone and open an app.</li>
          </ol>
        </div>
        <div className="col after">
          <div className="mono">With hush.</div>
          <p className="click">
            Click<span className="o">.</span>
          </p>
          <p>One click on the island at the edge of your screen. Your headphones switch, and your hands never left the keyboard.</p>
        </div>
      </div>
      <div className="uses">
        <article>
          <span className="ico i-amb" />
          <h3>On a call.</h3>
          <p>Let a colleague in with Ambient, then go back to quiet. No fumbling with the earcup mid sentence.</p>
        </article>
        <article>
          <span className="ico i-anc" />
          <h3>In deep work.</h3>
          <p>The cafe gets loud, you turn ANC on from your screen and keep typing. Your flow stays intact.</p>
        </article>
        <article>
          <span className="ico i-off" />
          <h3>On the move.</h3>
          <p>Hear the announcement with Ambient. Glance at the battery before you leave the desk.</p>
        </article>
      </div>
    </section>
  );
}
